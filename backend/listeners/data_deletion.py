"""Meta data-deletion webhook + status lookup.

Implements the callback Meta requires for app-review approval. When a user
removes the Tako app from their Meta account, Meta POSTs a signed_request
to ``/api/webhooks/meta/data-deletion``. We verify it, enqueue a purge job,
and return a status URL + confirmation code per Meta's spec:

    https://developers.facebook.com/docs/development/create-an-app/\
app-dashboard/data-deletion-callback/

Non-goals in v1:
- We do NOT attempt to resolve the Meta ``user_id`` back to specific FB posts
  the user authored. Our data model doesn't cleanly index by Meta user id on
  ``listener_hits``, so the conservative action is to revoke the OAuth token
  (stops all further polling of that user's Pages) and pause any listeners
  that depended on it. Hits already ingested age out via the standard
  retention job. If stricter deletion is required later, we can extend the
  purge to delete hits whose ``author.profile_url`` matches the user's
  stored profile URL.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---- Signed request parsing ------------------------------------------------

class SignedRequestError(ValueError):
    """Raised when the incoming signed_request fails verification."""


def _b64url_decode(s: str) -> bytes:
    """Meta uses URL-safe base64 without padding; restore padding before decode."""
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def parse_signed_request(signed_request: str, app_secret: str) -> dict[str, Any]:
    """Verify and decode a Meta ``signed_request`` string.

    Format: ``<sig_b64url>.<payload_b64url>`` where ``sig`` is the HMAC-SHA256
    of the ``payload_b64url`` bytes keyed by the app secret. Raises
    ``SignedRequestError`` on any failure — callers should map that to HTTP 400.
    """
    if not signed_request or "." not in signed_request:
        raise SignedRequestError("malformed signed_request")
    if not app_secret:
        raise SignedRequestError("META_APP_SECRET not configured")

    sig_b64, payload_b64 = signed_request.split(".", 1)
    try:
        sig = _b64url_decode(sig_b64)
        payload_raw = _b64url_decode(payload_b64)
    except Exception as exc:  # noqa: BLE001 — base64 throws many flavours
        raise SignedRequestError(f"base64 decode failed: {exc}") from exc

    expected = hmac.new(
        app_secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(expected, sig):
        raise SignedRequestError("signature mismatch")

    try:
        payload = json.loads(payload_raw.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise SignedRequestError(f"payload json decode failed: {exc}") from exc
    if payload.get("algorithm") != "HMAC-SHA256":
        raise SignedRequestError(f"unsupported algorithm {payload.get('algorithm')!r}")
    if not payload.get("user_id"):
        raise SignedRequestError("missing user_id in payload")
    return payload


# ---- Purge job -------------------------------------------------------------

async def purge_meta_user_data(meta_user_id: str, request_id: str) -> dict[str, int]:
    """Remove stored Meta user data and pause dependent listeners.

    Idempotent: repeat calls for the same ``meta_user_id`` are safe. Updates
    the ``data_deletion_requests`` audit row on completion.

    Imported lazily from ``server`` to avoid an import cycle (listeners/
    modules are loaded from ``server.py`` at boot).
    """
    from server import db  # late import — see module docstring

    stats = {
        "tokens_removed": 0,
        "listeners_paused": 0,
        "affected_orgs": 0,
    }

    now = datetime.now(timezone.utc)
    try:
        affected_orgs: set[str] = set()

        # 1. Find every org integration that stored this Meta user's token.
        cursor = db.org_integrations.find({
            "oauth_tokens.meta.user_id": meta_user_id,
        })
        async for doc in cursor:
            org_id = doc.get("organization_id") or doc.get("org_id")
            if not org_id:
                continue
            affected_orgs.add(org_id)
            # Unset the token sub-doc — other providers (google, linkedin)
            # are left intact.
            res = await db.org_integrations.update_one(
                {"_id": doc["_id"]},
                {"$unset": {"oauth_tokens.meta": ""}},
            )
            if res.modified_count:
                stats["tokens_removed"] += 1

        # 2. Pause listeners in those orgs that relied on Meta Pages
        #    (i.e. channel == "facebook" and status == "active").
        if affected_orgs:
            pause_res = await db.listeners.update_many(
                {
                    "organization_id": {"$in": list(affected_orgs)},
                    "channel": "facebook",
                    "status": "active",
                },
                {"$set": {
                    "status": "paused",
                    "paused_reason": "meta_data_deletion",
                    "updated_at": now,
                }},
            )
            stats["listeners_paused"] = pause_res.modified_count

        stats["affected_orgs"] = len(affected_orgs)

        await db.data_deletion_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "completed",
                "completed_at": now,
                "affected_orgs": list(affected_orgs),
                "purged": stats,
            }},
        )
        logger.info("meta data-deletion complete user=%s stats=%s", meta_user_id, stats)
    except Exception as exc:  # noqa: BLE001 — we want the audit row either way
        logger.exception("meta data-deletion failed user=%s", meta_user_id)
        await db.data_deletion_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "failed",
                "completed_at": now,
                "error": str(exc)[:500],
            }},
        )
        raise

    return stats


# ---- Router ----------------------------------------------------------------

class DataDeletionStatus(BaseModel):
    confirmation_code: str
    status: str  # "pending" | "completed" | "failed"
    requested_at: datetime
    completed_at: datetime | None = None
    summary: dict[str, Any] | None = None


def _public_base_url() -> str:
    """Base URL for the confirmation status page Meta embeds in the callback
    response. Falls back to the app URL or a sensible default."""
    return (
        os.environ.get("APP_PUBLIC_URL")
        or os.environ.get("FRONTEND_URL")
        or "https://app.tako.software"
    ).rstrip("/")


def bind_data_deletion(*, db) -> APIRouter:
    """Register the Meta data-deletion webhook + confirmation status endpoint."""
    r = APIRouter(prefix="/api", tags=["data-deletion"])

    @r.post("/webhooks/meta/data-deletion")
    async def receive_data_deletion(request: Request) -> dict[str, str]:
        """Meta's callback. Body is ``application/x-www-form-urlencoded`` with
        a single ``signed_request`` field. Must respond with a JSON object
        containing ``url`` and ``confirmation_code``; Meta shows the URL to
        the user so they can track deletion."""
        app_secret = os.environ.get("META_APP_SECRET", "")
        form = await request.form()
        signed_request = (form.get("signed_request") or "").strip()
        if not signed_request:
            # Allow JSON body as a fallback for tools that post this way.
            try:
                body = await request.json()
                signed_request = (body.get("signed_request") or "").strip()
            except Exception:  # noqa: BLE001
                signed_request = ""
        if not signed_request:
            raise HTTPException(status_code=400, detail="signed_request required")

        try:
            payload = parse_signed_request(signed_request, app_secret)
        except SignedRequestError as exc:
            logger.warning("meta data-deletion signed_request rejected: %s", exc)
            raise HTTPException(status_code=400, detail="invalid signed_request") from exc

        meta_user_id = str(payload["user_id"])
        request_id = f"ddr_{uuid.uuid4().hex}"
        # URL-safe 16-char code — collision-resistant, easy to display.
        confirmation_code = secrets.token_urlsafe(12)

        await db.data_deletion_requests.insert_one({
            "request_id": request_id,
            "confirmation_code": confirmation_code,
            "meta_user_id": meta_user_id,
            "status": "pending",
            "requested_at": datetime.now(timezone.utc),
            "completed_at": None,
            "affected_orgs": [],
            "purged": None,
            "error": None,
            "raw_payload": {
                "issued_at": payload.get("issued_at"),
                "algorithm": payload.get("algorithm"),
            },
        })

        # Enqueue the purge. We schedule it via APScheduler so the request
        # returns immediately — Meta's spec says the response must be fast.
        try:
            from jobs import scheduler
            scheduler.add_job(
                purge_meta_user_data,
                trigger="date",  # fire once, now
                args=[meta_user_id, request_id],
                id=f"purge_{request_id}",
                replace_existing=True,
                max_instances=1,
            )
        except Exception:  # noqa: BLE001
            # If the scheduler is unavailable, run inline — better to block
            # briefly than drop the deletion silently. Any exception inside
            # purge_meta_user_data is recorded on the audit row.
            logger.warning("scheduler unavailable, purging inline")
            try:
                await purge_meta_user_data(meta_user_id, request_id)
            except Exception:  # noqa: BLE001
                pass  # already logged + recorded in the audit row

        base = _public_base_url()
        return {
            "url": f"{base}/data-deletion/{confirmation_code}",
            "confirmation_code": confirmation_code,
        }

    @r.get("/account/data-deletion/{confirmation_code}", response_model=DataDeletionStatus)
    async def get_status(confirmation_code: str) -> DataDeletionStatus:
        """Public status lookup. No auth — the confirmation_code itself is the
        capability token. It reveals only aggregate counts, never the Meta
        user id or org ids."""
        doc = await db.data_deletion_requests.find_one({"confirmation_code": confirmation_code})
        if not doc:
            raise HTTPException(status_code=404, detail="Unknown confirmation code")
        purged = doc.get("purged") or {}
        summary = None
        if doc.get("status") == "completed":
            summary = {
                "tokens_removed": purged.get("tokens_removed", 0),
                "listeners_paused": purged.get("listeners_paused", 0),
                "affected_orgs": purged.get("affected_orgs", 0),
            }
        return DataDeletionStatus(
            confirmation_code=confirmation_code,
            status=doc.get("status", "pending"),
            requested_at=doc["requested_at"],
            completed_at=doc.get("completed_at"),
            summary=summary,
        )

    return r
