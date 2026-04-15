"""Inbound webhooks for the Listener.

Two providers in Phase 1/2:
  - `meta`: Meta Graph webhooks (Page/Webhook subscriptions). Payloads arrive as
    change feeds; we normalize and turn them into hits.
  - `chrome_extension`: the Tako extension posts observed group/page posts here
    when the manager is browsing FB in their own session.

Both flow through the generic `POST /webhooks/{provider}/{org_id}` dispatcher.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from listeners.pairing import validate_extension_token
from listeners.skills import classify_hit

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def bind_webhook_router(*, db):  # noqa: ANN001
    r = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

    @r.post("/{provider}/{org_id}")
    async def webhook_receiver(provider: str, org_id: str, request: Request):
        if provider == "meta":
            return await _handle_meta(request, org_id, db)
        if provider == "chrome_extension":
            return await _handle_extension(request, org_id, db)
        raise HTTPException(status_code=404, detail=f"Unknown webhook provider: {provider}")

    return r


# ------------------------------------------------------------------
# Meta webhook
# ------------------------------------------------------------------


async def _handle_meta(request: Request, org_id: str, db) -> dict:  # noqa: ANN001
    from oauth import validate_meta_signature  # late import

    body = await request.body()

    # Meta verify challenge (GET is handled by a separate endpoint; POSTs carry
    # signatures). During initial setup Meta pings with a hub.challenge GET that
    # callers should route to /api/webhooks/meta/verify — out of scope here.
    sig = request.headers.get("X-Hub-Signature-256")
    if not validate_meta_signature(body, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Normalize: Meta payloads have `entry[].changes[].value` shape. We extract
    # the minimum fields, dedupe on post id, and delegate classify.
    created = 0
    for entry in payload.get("entry", []) or []:
        page_id = entry.get("id")
        source = await db.listener_sources.find_one(
            {"external_id": {"$in": [f"page:{page_id}", page_id]}, "status": "active"},
            {"_id": 0},
        )
        if not source:
            continue
        listener = await db.listeners.find_one(
            {"listener_id": source["listener_id"], "organization_id": org_id, "status": "active"},
            {"_id": 0},
        )
        if not listener:
            continue
        for change in entry.get("changes", []) or []:
            value = change.get("value") or {}
            text = value.get("message") or value.get("item") or ""
            post_id = value.get("post_id") or value.get("comment_id") or ""
            if not (text and post_id):
                continue
            hit_doc = _build_hit(listener, source, post_id, text, value)
            try:
                await db.listener_hits.insert_one(hit_doc)
            except Exception:
                continue
            try:
                await classify_hit(hit_doc, listener, source)
                created += 1
            except Exception as e:  # noqa: BLE001
                logger.warning("meta webhook classify error: %s", e)
    return {"ok": True, "ingested": created}


# ------------------------------------------------------------------
# Chrome extension webhook
# ------------------------------------------------------------------


async def _handle_extension(request: Request, org_id: str, db) -> dict:  # noqa: ANN001
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    token = payload.get("extension_token") or request.headers.get("X-Tako-Extension-Token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing extension_token")
    token_doc = await validate_extension_token(db, token)
    if not token_doc or token_doc["organization_id"] != org_id:
        raise HTTPException(status_code=401, detail="Invalid extension token")

    source_url = payload.get("source_url") or ""
    source_type = payload.get("source_type") or "fb_group"
    source_name = payload.get("source_name") or source_url
    posts = payload.get("posts") or []

    if not source_url:
        raise HTTPException(status_code=400, detail="Missing source_url")

    # Find any listener in this org whose source matches this URL.
    from listeners.skills import _url_to_external_id  # late import

    ext_id = _url_to_external_id(source_url)
    source = await db.listener_sources.find_one({"external_id": ext_id}, {"_id": 0})
    if source:
        listener = await db.listeners.find_one(
            {"listener_id": source["listener_id"], "organization_id": org_id, "status": "active"},
            {"_id": 0},
        )
    else:
        listener = None

    if not listener:
        # Nothing configured yet — auto-file a pending_review source on the first
        # active listener for this org so the manager can wire it up with one click.
        listener = await db.listeners.find_one(
            {"organization_id": org_id, "status": "active", "channel": "facebook"},
            {"_id": 0},
        )
        if not listener:
            return {"ok": True, "ingested": 0, "note": "no active listener"}
        source = {
            "source_id": f"src_{uuid.uuid4().hex[:12]}",
            "listener_id": listener["listener_id"],
            "type": source_type,
            "external_id": ext_id,
            "url": source_url,
            "name": source_name,
            "status": "pending_review",
            "discovered_by": "manual",
            "last_scanned_at": None,
            "created_at": _utcnow().isoformat(),
        }
        try:
            await db.listener_sources.insert_one(source)
        except Exception:
            pass

    # Don't ingest hits from sources still pending review — avoids wasting
    # classifier calls on groups the manager hasn't confirmed they're a member of.
    if source.get("status") != "active":
        return {
            "ok": True,
            "ingested": 0,
            "note": "source pending_review — hits will flow once approved",
            "source_id": source.get("source_id"),
        }

    cfg = listener.get("config", {}) or {}
    keywords = [k.lower() for k in cfg.get("keywords", [])]
    negative = [k.lower() for k in cfg.get("negative_keywords", [])]

    created = 0
    for post in posts:
        text = post.get("text", "") or ""
        if not text:
            continue
        lower = text.lower()
        matched = [kw for kw in keywords if kw in lower]
        if not matched:
            continue
        if any(neg in lower for neg in negative):
            continue
        hit_doc = {
            "hit_id": f"hit_{uuid.uuid4().hex[:12]}",
            "listener_id": listener["listener_id"],
            "source_id": source["source_id"],
            "external_post_id": post.get("external_post_id") or post.get("url", ""),
            "url": post.get("url", ""),
            "author": {
                "name": (post.get("author") or {}).get("name", ""),
                "profile_url": (post.get("author") or {}).get("profile_url", ""),
            },
            "text": text,
            "matched_keywords": matched,
            "classification": "noise",
            "confidence": 0.0,
            "sentiment": None,
            "suggested_reply": None,
            "acted_on": False,
            "related_task_id": None,
            "seen_at": _utcnow().isoformat(),
            "classified_at": None,
        }
        try:
            await db.listener_hits.insert_one(hit_doc)
        except Exception:
            continue
        try:
            await classify_hit(hit_doc, listener, source)
            created += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("extension classify error: %s", e)
    return {"ok": True, "ingested": created}


def _build_hit(listener: dict, source: dict, post_id: str, text: str, raw: dict) -> dict:
    return {
        "hit_id": f"hit_{uuid.uuid4().hex[:12]}",
        "listener_id": listener["listener_id"],
        "source_id": source["source_id"],
        "external_post_id": post_id,
        "url": raw.get("permalink_url") or f"https://www.facebook.com/{post_id}",
        "author": {"name": (raw.get("from") or {}).get("name", ""), "profile_url": ""},
        "text": text,
        "matched_keywords": [],
        "classification": "noise",
        "confidence": 0.0,
        "sentiment": None,
        "suggested_reply": None,
        "acted_on": False,
        "related_task_id": None,
        "seen_at": _utcnow().isoformat(),
        "classified_at": None,
    }
