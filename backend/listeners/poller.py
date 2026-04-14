"""Meta Graph poller + scheduler wiring for listeners.

Three jobs:
  - `listener_poll_meta_pages(listener_id)` — per listener, cadence from config
  - `listener_rescore_hits(listener_id)` — hourly, re-classify borderline hits
  - `listener_generate_digest(listener_id)` — daily/weekly per listener config

On startup we call `reschedule_all_listeners()` to ensure every active listener
has its jobs registered (idempotent; `replace_existing=True`).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from jobs import JOB_REGISTRY, register_job, scheduler
from listeners.skills import classify_hit, generate_report

logger = logging.getLogger(__name__)

META_GRAPH = "https://graph.facebook.com/v19.0"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------------------------------------------
# Meta Graph polling
# ------------------------------------------------------------------


@register_job("listener_poll_meta_pages")
async def poll_meta_pages(listener_id: str) -> None:
    """Poll all fb_page sources for this listener.

    Fetches posts since `source.last_scanned_at`, keyword-prefilters, dedupes on
    `external_post_id`, inserts as hits, then classifies.

    Groups are NOT handled here — the extension ingest path covers them.
    """
    from oauth import get_org_token  # late import
    from server import db  # late import

    listener = await db.listeners.find_one({"listener_id": listener_id, "status": "active"})
    if not listener:
        logger.info("poll_meta_pages: listener %s missing/inactive — skip", listener_id)
        return

    token_doc = await get_org_token(listener["organization_id"], "meta")
    if not token_doc or not token_doc.get("access_token"):
        logger.debug("poll_meta_pages: no Meta token for org %s", listener["organization_id"])
        return

    cfg = listener.get("config", {}) or {}
    keywords = [k.lower() for k in cfg.get("keywords", [])]
    negative = [k.lower() for k in cfg.get("negative_keywords", [])]

    sources = db.listener_sources.find(
        {"listener_id": listener_id, "type": "fb_page", "status": "active"},
        {"_id": 0},
    )
    async with httpx.AsyncClient(timeout=30) as hc:
        async for source in sources:
            await _poll_single_page(hc, source, token_doc["access_token"], listener, keywords, negative)

    await db.listeners.update_one(
        {"listener_id": listener_id},
        {"$set": {"stats.last_poll_at": _utcnow().isoformat()}},
    )


async def _poll_single_page(
    hc: httpx.AsyncClient,
    source: dict,
    access_token: str,
    listener: dict,
    keywords: list[str],
    negative: list[str],
) -> None:
    from server import db  # late import

    # external_id formats: "page:<slug>" (discovered) OR raw numeric Page ID.
    page_id = source["external_id"].split(":", 1)[-1]
    since_iso = source.get("last_scanned_at")
    params = {
        "access_token": access_token,
        "fields": "id,message,created_time,permalink_url,from",
        "limit": 50,
    }
    if since_iso:
        try:
            params["since"] = int(datetime.fromisoformat(since_iso).timestamp())
        except Exception:
            pass
    try:
        resp = await hc.get(f"{META_GRAPH}/{page_id}/posts", params=params)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as e:
        logger.warning("meta graph error for page %s: %s", page_id, e)
        return

    for post in data.get("data", []):
        text = post.get("message") or ""
        if not text:
            continue
        lower = text.lower()
        matched = [kw for kw in keywords if kw in lower]
        if not matched:
            continue
        if any(neg in lower for neg in negative):
            continue

        external_post_id = post.get("id", "")
        hit_doc = {
            "hit_id": f"hit_{uuid.uuid4().hex[:12]}",
            "listener_id": listener["listener_id"],
            "source_id": source["source_id"],
            "external_post_id": external_post_id,
            "url": post.get("permalink_url") or f"https://www.facebook.com/{external_post_id}",
            "author": {
                "name": (post.get("from") or {}).get("name", ""),
                "profile_url": "",
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
            continue  # duplicate
        try:
            await classify_hit(hit_doc, listener, source)
        except Exception as e:  # noqa: BLE001
            logger.warning("classify error: %s", e)

    await db.listener_sources.update_one(
        {"source_id": source["source_id"]},
        {"$set": {"last_scanned_at": _utcnow().isoformat()}},
    )


# ------------------------------------------------------------------
# Rescore borderline hits (hourly)
# ------------------------------------------------------------------


@register_job("listener_rescore_hits")
async def rescore_hits(listener_id: str) -> None:
    from server import db  # late import

    listener = await db.listeners.find_one({"listener_id": listener_id, "status": "active"})
    if not listener:
        return
    cutoff = (_utcnow() - timedelta(hours=24)).isoformat()
    borderline = db.listener_hits.find(
        {
            "listener_id": listener_id,
            "classification": {"$in": ["mention", "noise"]},
            "confidence": {"$gte": 0.4, "$lt": float(listener.get("config", {}).get("min_confidence", 0.7))},
            "classified_at": {"$lte": cutoff},
        },
        {"_id": 0},
    ).limit(50)
    async for hit in borderline:
        source = await db.listener_sources.find_one({"source_id": hit["source_id"]}, {"_id": 0})
        try:
            await classify_hit(hit, listener, source)
        except Exception as e:  # noqa: BLE001
            logger.warning("rescore classify error hit=%s: %s", hit.get("hit_id"), e)


# ------------------------------------------------------------------
# Digest generator
# ------------------------------------------------------------------


@register_job("listener_generate_digest")
async def generate_digest(listener_id: str) -> None:
    from server import db  # late import

    listener = await db.listeners.find_one({"listener_id": listener_id, "status": "active"})
    if not listener:
        return
    cadence = (listener.get("config", {}) or {}).get("digest_cadence", "weekly")
    days = 7 if cadence == "weekly" else 1
    end = _utcnow()
    start = end - timedelta(days=days)
    await generate_report(listener, start, end)


# ------------------------------------------------------------------
# Scheduling
# ------------------------------------------------------------------


def _cadence_to_minutes(cadence: str) -> int:
    return {"15min": 15, "hourly": 60, "daily": 60 * 24}.get(cadence, 60)


def schedule_listener_jobs(listener: dict) -> None:
    """Register poll / rescore / digest for a single listener. Idempotent."""
    lid = listener["listener_id"]
    cadence_min = _cadence_to_minutes((listener.get("config") or {}).get("cadence", "hourly"))
    scheduler.add_job(
        poll_meta_pages,
        trigger="interval",
        minutes=cadence_min,
        args=[lid],
        id=f"poll_{lid}",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        rescore_hits,
        trigger="interval",
        hours=1,
        args=[lid],
        id=f"rescore_{lid}",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    digest = (listener.get("config") or {}).get("digest_cadence", "weekly")
    digest_hours = 24 * (7 if digest == "weekly" else 1)
    scheduler.add_job(
        generate_digest,
        trigger="interval",
        hours=digest_hours,
        args=[lid],
        id=f"digest_{lid}",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )


def unschedule_listener_jobs(listener_id: str) -> None:
    for prefix in ("poll_", "rescore_", "digest_"):
        try:
            scheduler.remove_job(f"{prefix}{listener_id}")
        except Exception:
            pass


async def reschedule_all_listeners() -> None:
    """Called on app startup — ensures every active listener has its jobs."""
    from server import db  # late import

    count = 0
    async for listener in db.listeners.find({"status": "active"}, {"_id": 0}):
        schedule_listener_jobs(listener)
        count += 1
    logger.info("Scheduled jobs for %d active listeners", count)
