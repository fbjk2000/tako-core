"""REST API for listeners, sources, hits, reports.

Mounted under the same `/api` prefix as the rest of Tako by including this
router from server.py.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from listeners.models import (
    HitPatch,
    ListenerCreate,
    ListenerUpdate,
    SourceCreate,
    SourcePatch,
)
from listeners.poller import (
    generate_digest,
    schedule_listener_jobs,
    unschedule_listener_jobs,
)
from listeners.skills import discover_groups, generate_report

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _require_org(user: dict) -> str:
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization on current user")
    return org_id


def bind_deps(*, get_current_user, ensure_user_org, db, tako_ai_text):  # noqa: ANN001
    """Wire server.py's globals into this router's endpoints.

    Must be called exactly once from server.py before `app.include_router`.
    Returns a FastAPI APIRouter ready to include.
    """

    r = APIRouter(prefix="/api", tags=["listeners"])

    # ---- helpers -------------------------------------------------

    async def _get_listener(org_id: str, listener_id: str) -> dict:
        listener = await db.listeners.find_one(
            {"listener_id": listener_id, "organization_id": org_id}, {"_id": 0}
        )
        if not listener:
            raise HTTPException(status_code=404, detail="Listener not found")
        return listener

    # ---- Listener CRUD ------------------------------------------

    @r.post("/listeners")
    async def create_listener(data: ListenerCreate, current_user: dict = Depends(get_current_user)):
        if not current_user.get("organization_id"):
            current_user["organization_id"] = await ensure_user_org(current_user)
        org_id = current_user["organization_id"]

        # Validate campaign exists and belongs to org
        campaign = await db.campaigns.find_one(
            {"campaign_id": data.campaign_id, "organization_id": org_id}, {"_id": 0}
        )
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        listener_id = f"lst_{uuid.uuid4().hex[:12]}"
        now = _utcnow()
        doc = {
            "listener_id": listener_id,
            "organization_id": org_id,
            "campaign_id": data.campaign_id,
            "channel": data.channel,
            "status": "active",
            "config": data.config.model_dump(),
            "stats": {"hits_total": 0, "tasks_created": 0, "last_poll_at": None},
            "created_by": current_user["user_id"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        await db.listeners.insert_one(doc)
        # Backfill channel_type on campaign if it was created pre-refactor
        await db.campaigns.update_one(
            {"campaign_id": data.campaign_id, "channel_type": {"$exists": False}},
            {"$set": {"channel_type": data.channel}},
        )
        schedule_listener_jobs(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/listeners")
    async def list_listeners(
        campaign_id: Optional[str] = Query(default=None),
        current_user: dict = Depends(get_current_user),
    ):
        org_id = _require_org(current_user)
        q: dict = {"organization_id": org_id}
        if campaign_id:
            q["campaign_id"] = campaign_id
        cursor = db.listeners.find(q, {"_id": 0}).sort("created_at", -1)
        return await cursor.to_list(length=200)

    @r.get("/listeners/{listener_id}")
    async def get_listener(listener_id: str, current_user: dict = Depends(get_current_user)):
        org_id = _require_org(current_user)
        return await _get_listener(org_id, listener_id)

    @r.patch("/listeners/{listener_id}")
    async def patch_listener(
        listener_id: str,
        data: ListenerUpdate,
        current_user: dict = Depends(get_current_user),
    ):
        org_id = _require_org(current_user)
        listener = await _get_listener(org_id, listener_id)
        updates: dict = {"updated_at": _utcnow().isoformat()}
        if data.status is not None:
            updates["status"] = data.status
        if data.config is not None:
            updates["config"] = data.config.model_dump()
        await db.listeners.update_one({"listener_id": listener_id}, {"$set": updates})
        listener.update(updates)
        # Reschedule on status/config change
        if updates.get("status") == "active":
            schedule_listener_jobs(listener)
        elif updates.get("status") in ("paused", "archived"):
            unschedule_listener_jobs(listener_id)
        elif "config" in updates and listener.get("status") == "active":
            schedule_listener_jobs(listener)
        return listener

    @r.delete("/listeners/{listener_id}")
    async def archive_listener(listener_id: str, current_user: dict = Depends(get_current_user)):
        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        await db.listeners.update_one(
            {"listener_id": listener_id},
            {"$set": {"status": "archived", "updated_at": _utcnow().isoformat()}},
        )
        unschedule_listener_jobs(listener_id)
        return {"message": "Listener archived"}

    # ---- Sources -------------------------------------------------

    @r.get("/listeners/{listener_id}/sources")
    async def list_sources(listener_id: str, current_user: dict = Depends(get_current_user)):
        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        cursor = db.listener_sources.find({"listener_id": listener_id}, {"_id": 0}).sort("created_at", -1)
        return await cursor.to_list(length=500)

    @r.post("/listeners/{listener_id}/sources")
    async def add_source(
        listener_id: str,
        data: SourceCreate,
        current_user: dict = Depends(get_current_user),
    ):
        from listeners.skills import _url_to_external_id  # late import

        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        ext = data.external_id or _url_to_external_id(data.url)
        if not ext:
            raise HTTPException(status_code=400, detail="Could not derive external_id from URL")
        source_id = f"src_{uuid.uuid4().hex[:12]}"
        now = _utcnow().isoformat()
        doc = {
            "source_id": source_id,
            "listener_id": listener_id,
            "type": data.type,
            "external_id": ext,
            "url": data.url,
            "name": data.name or data.url,
            "status": "pending_review",
            "discovered_by": "manual",
            "last_scanned_at": None,
            "created_at": now,
        }
        try:
            await db.listener_sources.insert_one(doc)
        except Exception as e:
            raise HTTPException(status_code=409, detail=f"Source already exists: {e}")
        doc.pop("_id", None)
        return doc

    @r.patch("/listeners/{listener_id}/sources/{source_id}")
    async def patch_source(
        listener_id: str,
        source_id: str,
        data: SourcePatch,
        current_user: dict = Depends(get_current_user),
    ):
        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        updates: dict = {}
        if data.status is not None:
            updates["status"] = data.status
        if data.joined:
            updates["joined_at"] = _utcnow().isoformat()
            updates["status"] = "active"
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        await db.listener_sources.update_one(
            {"source_id": source_id, "listener_id": listener_id}, {"$set": updates}
        )
        return await db.listener_sources.find_one(
            {"source_id": source_id}, {"_id": 0}
        )

    @r.delete("/listeners/{listener_id}/sources/{source_id}")
    async def delete_source(
        listener_id: str,
        source_id: str,
        current_user: dict = Depends(get_current_user),
    ):
        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        await db.listener_sources.delete_one(
            {"source_id": source_id, "listener_id": listener_id}
        )
        return {"message": "Source deleted"}

    # ---- Hits ---------------------------------------------------

    @r.get("/listeners/{listener_id}/hits")
    async def list_hits(
        listener_id: str,
        since: Optional[str] = Query(default=None),
        classification: Optional[str] = Query(default=None),
        acted_on: Optional[bool] = Query(default=None),
        limit: int = Query(default=100, le=500),
        current_user: dict = Depends(get_current_user),
    ):
        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        q: dict = {"listener_id": listener_id}
        if since:
            q["seen_at"] = {"$gte": since}
        if classification:
            q["classification"] = classification
        if acted_on is not None:
            q["acted_on"] = acted_on
        cursor = db.listener_hits.find(q, {"_id": 0}).sort("seen_at", -1).limit(limit)
        return await cursor.to_list(length=limit)

    @r.patch("/listeners/{listener_id}/hits/{hit_id}")
    async def patch_hit(
        listener_id: str,
        hit_id: str,
        data: HitPatch,
        current_user: dict = Depends(get_current_user),
    ):
        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        await db.listener_hits.update_one(
            {"hit_id": hit_id, "listener_id": listener_id}, {"$set": updates}
        )
        return await db.listener_hits.find_one({"hit_id": hit_id}, {"_id": 0})

    @r.post("/listeners/{listener_id}/hits/{hit_id}/create-task")
    async def create_task_from_hit(
        listener_id: str,
        hit_id: str,
        current_user: dict = Depends(get_current_user),
    ):
        from listeners.skills import _create_listener_task  # late import

        org_id = _require_org(current_user)
        listener = await _get_listener(org_id, listener_id)
        hit = await db.listener_hits.find_one(
            {"hit_id": hit_id, "listener_id": listener_id}, {"_id": 0}
        )
        if not hit:
            raise HTTPException(status_code=404, detail="Hit not found")
        if hit.get("related_task_id"):
            return {"task_id": hit["related_task_id"], "note": "already linked"}
        task_id = await _create_listener_task(
            hit, listener, hit.get("classification", "mention"), hit.get("suggested_reply")
        )
        await db.listener_hits.update_one(
            {"hit_id": hit_id}, {"$set": {"related_task_id": task_id, "acted_on": True}}
        )
        return {"task_id": task_id}

    # ---- Reports -------------------------------------------------

    @r.get("/listeners/{listener_id}/reports")
    async def list_reports(listener_id: str, current_user: dict = Depends(get_current_user)):
        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        cursor = db.listener_reports.find({"listener_id": listener_id}, {"_id": 0}).sort("period_end", -1)
        return await cursor.to_list(length=50)

    @r.get("/listeners/{listener_id}/reports/{report_id}")
    async def get_report(
        listener_id: str, report_id: str, current_user: dict = Depends(get_current_user)
    ):
        org_id = _require_org(current_user)
        await _get_listener(org_id, listener_id)
        report = await db.listener_reports.find_one(
            {"report_id": report_id, "listener_id": listener_id}, {"_id": 0}
        )
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report

    @r.post("/listeners/{listener_id}/reports/generate-now")
    async def generate_now(
        listener_id: str,
        days: int = Query(default=7, ge=1, le=90),
        current_user: dict = Depends(get_current_user),
    ):
        org_id = _require_org(current_user)
        listener = await _get_listener(org_id, listener_id)
        end = _utcnow()
        start = end - timedelta(days=days)
        return await generate_report(listener, start, end)

    # ---- Discovery ------------------------------------------------

    @r.post("/listeners/{listener_id}/discover")
    async def run_discovery(listener_id: str, current_user: dict = Depends(get_current_user)):
        org_id = _require_org(current_user)
        listener = await _get_listener(org_id, listener_id)
        saved = await discover_groups(listener)
        return {"discovered": len(saved), "sources": saved}

    return r
