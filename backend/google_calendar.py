"""Google Calendar two-way sync + local cache.

Design:
- Events live in MongoDB `google_calendar_events` (per user_id, indexed on google_event_id).
- Sync uses Google's `syncToken` for incremental updates (cheap).
- Background APScheduler job polls every 2 minutes per connected user.
- Frontend reads from the local cache (fast), not directly from Google.
- CRUD (create/update/delete) goes to Google first; local cache is updated from the response.
- If sync_token expires (410), we do a full sync and reset the token.

Collection schemas:

`google_calendar_tokens`:
  user_id, access_token, refresh_token, token_uri, client_id, client_secret,
  scopes, expiry, connected_at, sync_token?, last_sync_at?, last_sync_error?

`google_calendar_events`:
  user_id, google_event_id, calendar_id, etag, status, summary, description,
  location, start_iso, end_iso, all_day, start_timezone, attendees, organizer,
  html_link, hangout_link, color_id, recurring_event_id, is_recurring,
  google_updated, last_synced_at, deleted (bool, for tombstones until next full sync)
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]
PRIMARY_CALENDAR = "primary"


# ---------------------------------------------------------------------------
# Credentials helpers
# ---------------------------------------------------------------------------

def _build_credentials(token_doc: dict) -> Credentials:
    return Credentials(
        token=token_doc["access_token"],
        refresh_token=token_doc.get("refresh_token"),
        token_uri=token_doc.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_doc.get("client_id", GOOGLE_CLIENT_ID),
        client_secret=token_doc.get("client_secret", GOOGLE_CLIENT_SECRET),
        scopes=token_doc.get("scopes", GOOGLE_SCOPES),
    )


async def _persist_refreshed_token(db, user_id: str, creds: Credentials, original_token: str) -> None:
    """If google-auth refreshed the access token under the hood, persist it."""
    if creds.token and creds.token != original_token:
        await db.google_calendar_tokens.update_one(
            {"user_id": user_id},
            {"$set": {
                "access_token": creds.token,
                "expiry": creds.expiry.isoformat() if creds.expiry else None,
            }},
        )


async def _get_service(db, user_id: str):
    """Return (service, creds, token_doc) or raise a RuntimeError if not connected."""
    token_doc = await db.google_calendar_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not token_doc:
        raise RuntimeError("Google Calendar not connected")
    creds = _build_credentials(token_doc)
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)
    return service, creds, token_doc


# ---------------------------------------------------------------------------
# Event mapping
# ---------------------------------------------------------------------------

def _extract_start_end(g_event: dict) -> tuple[str, str, bool, str]:
    """Return (start_iso, end_iso, all_day, timezone). All-day events use date-only."""
    start_obj = g_event.get("start", {}) or {}
    end_obj = g_event.get("end", {}) or {}
    all_day = bool(start_obj.get("date") and not start_obj.get("dateTime"))
    if all_day:
        # date is YYYY-MM-DD; we store as midnight UTC so clients can filter
        start_iso = f"{start_obj['date']}T00:00:00+00:00"
        end_iso = f"{end_obj.get('date', start_obj['date'])}T00:00:00+00:00"
    else:
        start_iso = start_obj.get("dateTime", "")
        end_iso = end_obj.get("dateTime", start_iso)
    return start_iso, end_iso, all_day, start_obj.get("timeZone", "")


def map_google_event(g_event: dict, user_id: str, calendar_id: str = PRIMARY_CALENDAR) -> dict:
    """Transform Google Calendar event to our storage + API format."""
    start_iso, end_iso, all_day, tz = _extract_start_end(g_event)
    attendees = []
    for a in g_event.get("attendees", []) or []:
        attendees.append({
            "email": a.get("email", ""),
            "displayName": a.get("displayName", ""),
            "responseStatus": a.get("responseStatus", "needsAction"),
            "organizer": bool(a.get("organizer")),
            "self": bool(a.get("self")),
        })
    organizer = g_event.get("organizer") or {}
    conference = g_event.get("conferenceData") or {}
    hangout_link = g_event.get("hangoutLink", "")
    # Fall back to any video entry point
    if not hangout_link and conference.get("entryPoints"):
        for ep in conference["entryPoints"]:
            if ep.get("entryPointType") == "video":
                hangout_link = ep.get("uri", "")
                break

    return {
        "user_id": user_id,
        "calendar_id": calendar_id,
        "google_event_id": g_event["id"],
        "etag": g_event.get("etag", ""),
        "status": g_event.get("status", "confirmed"),
        "summary": g_event.get("summary", "(no title)"),
        "description": g_event.get("description", ""),
        "location": g_event.get("location", ""),
        "start_iso": start_iso,
        "end_iso": end_iso,
        "all_day": all_day,
        "start_timezone": tz,
        "attendees": attendees,
        "organizer": {
            "email": organizer.get("email", ""),
            "displayName": organizer.get("displayName", ""),
            "self": bool(organizer.get("self")),
        },
        "html_link": g_event.get("htmlLink", ""),
        "hangout_link": hangout_link,
        "color_id": g_event.get("colorId", ""),
        "recurring_event_id": g_event.get("recurringEventId", ""),
        "is_recurring": bool(g_event.get("recurringEventId")) or bool(g_event.get("recurrence")),
        "google_updated": g_event.get("updated", ""),
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
    }


def event_to_api(doc: dict) -> dict:
    """Shape a stored doc into the TAKO calendar event format the frontend expects."""
    return {
        "id": f"gcal_{doc['google_event_id']}",
        "google_id": doc["google_event_id"],
        "type": "google",
        "title": doc.get("summary") or "(no title)",
        "date": doc.get("start_iso") or "",
        "end_date": doc.get("end_iso") or "",
        "all_day": doc.get("all_day", False),
        "notes": doc.get("description") or "",
        "location": doc.get("location") or "",
        "color": "#4285f4",
        "html_link": doc.get("html_link") or "",
        "hangout_link": doc.get("hangout_link") or "",
        "attendees": doc.get("attendees") or [],
        "organizer": doc.get("organizer") or {},
        "status": doc.get("status") or "confirmed",
        "is_recurring": doc.get("is_recurring", False),
        "etag": doc.get("etag") or "",
    }


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------

async def _upsert_event(db, doc: dict) -> None:
    await db.google_calendar_events.update_one(
        {"user_id": doc["user_id"], "google_event_id": doc["google_event_id"]},
        {"$set": doc},
        upsert=True,
    )


async def _delete_cached_event(db, user_id: str, google_event_id: str) -> None:
    await db.google_calendar_events.delete_one(
        {"user_id": user_id, "google_event_id": google_event_id}
    )


async def _full_sync(db, user_id: str, service) -> str | None:
    """Full sync: fetch all events in a reasonable window, return the new syncToken.

    We purposely use a wider window than before (-60d, +180d) so multi-month
    planning works. The sync_token then covers everything afterwards.
    """
    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=60)).isoformat()
    time_max = (now + timedelta(days=180)).isoformat()

    # Clear cache for a clean rebuild (avoids stale docs outside window)
    await db.google_calendar_events.delete_many({"user_id": user_id})

    page_token = None
    next_sync_token = None
    fetched = 0
    while True:
        req = service.events().list(
            calendarId=PRIMARY_CALENDAR,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            showDeleted=False,
            maxResults=250,
            pageToken=page_token,
        )
        resp = req.execute()
        for item in resp.get("items", []):
            doc = map_google_event(item, user_id)
            await _upsert_event(db, doc)
            fetched += 1
        page_token = resp.get("nextPageToken")
        if not page_token:
            next_sync_token = resp.get("nextSyncToken")
            break

    logger.info("Google Calendar full sync for user=%s: %d events", user_id, fetched)
    return next_sync_token


async def _incremental_sync(db, user_id: str, service, sync_token: str) -> str | None:
    """Incremental sync using syncToken. Returns new token, or raises if token invalid."""
    page_token = None
    next_sync_token = None
    changes = 0
    deletions = 0
    while True:
        req = service.events().list(
            calendarId=PRIMARY_CALENDAR,
            singleEvents=True,
            showDeleted=True,
            maxResults=250,
            syncToken=sync_token if page_token is None else None,
            pageToken=page_token,
        )
        resp = req.execute()
        for item in resp.get("items", []):
            if item.get("status") == "cancelled":
                await _delete_cached_event(db, user_id, item["id"])
                deletions += 1
            else:
                doc = map_google_event(item, user_id)
                await _upsert_event(db, doc)
                changes += 1
        page_token = resp.get("nextPageToken")
        if not page_token:
            next_sync_token = resp.get("nextSyncToken")
            break

    if changes or deletions:
        logger.info("Google Calendar incremental sync user=%s: %d changed, %d deleted",
                    user_id, changes, deletions)
    return next_sync_token


async def sync_user_calendar(db, user_id: str) -> dict:
    """Run a sync for a single user. Uses incremental sync when possible.

    Returns: {"status": "ok"|"error"|"not_connected", "mode": "full"|"incremental"|None,
              "sync_token": str|None, "error": str|None}
    """
    try:
        service, creds, token_doc = await _get_service(db, user_id)
    except RuntimeError:
        return {"status": "not_connected", "mode": None, "sync_token": None, "error": None}

    original_token = token_doc["access_token"]
    existing_sync_token = token_doc.get("sync_token")
    mode = "incremental" if existing_sync_token else "full"
    new_token: str | None = None
    error: str | None = None

    try:
        if existing_sync_token:
            try:
                new_token = await _incremental_sync(db, user_id, service, existing_sync_token)
            except HttpError as e:
                # 410 Gone → sync token expired, fall back to full sync
                if e.resp.status == 410:
                    logger.info("Sync token expired for user=%s, doing full sync", user_id)
                    mode = "full"
                    new_token = await _full_sync(db, user_id, service)
                else:
                    raise
        else:
            new_token = await _full_sync(db, user_id, service)
    except Exception as e:  # noqa: BLE001
        logger.exception("Google Calendar sync failed for user=%s: %s", user_id, e)
        error = str(e)

    # Persist refreshed access token if auto-refreshed
    await _persist_refreshed_token(db, user_id, creds, original_token)

    update = {
        "last_sync_at": datetime.now(timezone.utc).isoformat(),
        "last_sync_error": error,
    }
    if new_token:
        update["sync_token"] = new_token
    await db.google_calendar_tokens.update_one({"user_id": user_id}, {"$set": update})

    return {
        "status": "error" if error else "ok",
        "mode": mode,
        "sync_token": new_token,
        "error": error,
    }


# ---------------------------------------------------------------------------
# Read (from cache)
# ---------------------------------------------------------------------------

async def list_cached_events(db, user_id: str, days_past: int = 60, days_future: int = 180) -> list[dict]:
    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=days_past)).isoformat()
    time_max = (now + timedelta(days=days_future)).isoformat()
    cursor = db.google_calendar_events.find(
        {
            "user_id": user_id,
            "start_iso": {"$gte": time_min, "$lte": time_max},
            "status": {"$ne": "cancelled"},
        },
        {"_id": 0},
    ).sort("start_iso", 1)
    return [event_to_api(doc) async for doc in cursor]


# ---------------------------------------------------------------------------
# CRUD (write-through to Google + local cache)
# ---------------------------------------------------------------------------

def _body_from_payload(payload: dict) -> dict:
    """Translate our input payload into a Google Calendar API event body."""
    body: dict[str, Any] = {}
    if "summary" in payload:
        body["summary"] = payload["summary"]
    if "description" in payload:
        body["description"] = payload["description"] or ""
    if "location" in payload:
        body["location"] = payload["location"] or ""
    if payload.get("all_day"):
        # Expect YYYY-MM-DD in start_date / end_date
        if payload.get("start_date"):
            body["start"] = {"date": payload["start_date"]}
        if payload.get("end_date"):
            body["end"] = {"date": payload["end_date"]}
    else:
        if payload.get("start_iso"):
            body["start"] = {"dateTime": payload["start_iso"]}
            if payload.get("timezone"):
                body["start"]["timeZone"] = payload["timezone"]
        if payload.get("end_iso"):
            body["end"] = {"dateTime": payload["end_iso"]}
            if payload.get("timezone"):
                body["end"]["timeZone"] = payload["timezone"]
    if "attendees" in payload and isinstance(payload["attendees"], list):
        body["attendees"] = [{"email": e} for e in payload["attendees"] if isinstance(e, str) and "@" in e]
    return body


async def create_event(db, user_id: str, payload: dict) -> dict:
    service, creds, token_doc = await _get_service(db, user_id)
    original_token = token_doc["access_token"]
    body = _body_from_payload(payload)
    if "summary" not in body:
        raise ValueError("summary required")
    if "start" not in body or "end" not in body:
        raise ValueError("start and end required")
    send_updates = "all" if body.get("attendees") else "none"
    created = service.events().insert(
        calendarId=PRIMARY_CALENDAR, body=body, sendUpdates=send_updates,
    ).execute()
    await _persist_refreshed_token(db, user_id, creds, original_token)
    doc = map_google_event(created, user_id)
    await _upsert_event(db, doc)
    return event_to_api(doc)


async def update_event(db, user_id: str, google_event_id: str, payload: dict) -> dict:
    service, creds, token_doc = await _get_service(db, user_id)
    original_token = token_doc["access_token"]
    # Patch semantics: only send changed fields
    body = _body_from_payload(payload)
    send_updates = "all" if body.get("attendees") else "none"
    updated = service.events().patch(
        calendarId=PRIMARY_CALENDAR,
        eventId=google_event_id,
        body=body,
        sendUpdates=send_updates,
    ).execute()
    await _persist_refreshed_token(db, user_id, creds, original_token)
    doc = map_google_event(updated, user_id)
    await _upsert_event(db, doc)
    return event_to_api(doc)


async def delete_event(db, user_id: str, google_event_id: str) -> None:
    service, creds, token_doc = await _get_service(db, user_id)
    original_token = token_doc["access_token"]
    try:
        service.events().delete(
            calendarId=PRIMARY_CALENDAR,
            eventId=google_event_id,
            sendUpdates="all",
        ).execute()
    except HttpError as e:
        # 410 Gone means already deleted — treat as success
        if e.resp.status not in (404, 410):
            raise
    await _persist_refreshed_token(db, user_id, creds, original_token)
    await _delete_cached_event(db, user_id, google_event_id)


# ---------------------------------------------------------------------------
# Background sync job
# ---------------------------------------------------------------------------

async def sync_all_connected_users(db) -> dict:
    """Sync every user who has a Google Calendar token."""
    summary = {"users": 0, "ok": 0, "errors": 0}
    async for token in db.google_calendar_tokens.find({}, {"user_id": 1}):
        summary["users"] += 1
        try:
            result = await sync_user_calendar(db, token["user_id"])
            if result["status"] == "ok":
                summary["ok"] += 1
            else:
                summary["errors"] += 1
        except Exception as e:  # noqa: BLE001
            logger.exception("Sync job error for user=%s: %s", token["user_id"], e)
            summary["errors"] += 1
    if summary["users"]:
        logger.info("Google Calendar sync cycle: %s", summary)
    return summary


# ---------------------------------------------------------------------------
# APScheduler entry point
# ---------------------------------------------------------------------------
#
# APScheduler with the MongoDBJobStore pickles the job function reference,
# so it MUST be a top-level module function — no closures over `db`.
# We late-import server.db here to mirror the listeners/poller.py pattern.

try:
    from jobs import register_job
except ImportError:  # pragma: no cover — jobs module always present in runtime
    def register_job(_name):  # type: ignore
        def _deco(fn):
            return fn
        return _deco


@register_job("google_calendar_sync_all")
async def google_calendar_sync_all() -> None:
    """Scheduled entry point — runs every 2 minutes from APScheduler."""
    from server import db  # late import to avoid circular dependency

    await sync_all_connected_users(db)
