"""APScheduler singleton + job registry.

Started from FastAPI's startup hook in server.py. Uses Mongo for persistence so
scheduled jobs survive restarts.

Registering a job:

    from jobs import register_job, scheduler

    @register_job("listener_poll_meta_pages")
    async def poll_meta_pages(listener_id: str):
        ...

Then to schedule (typically from a route or at startup):

    scheduler.add_job(
        poll_meta_pages,
        "interval",
        minutes=30,
        args=[listener_id],
        id=f"poll_{listener_id}",
        replace_existing=True,
    )
"""

from __future__ import annotations

import logging
import os
from typing import Any, Awaitable, Callable

from apscheduler.jobstores.mongodb import MongoDBJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from pymongo import MongoClient

logger = logging.getLogger(__name__)

# Separate pymongo client for APScheduler (MongoDBJobStore is sync).
_sync_client = MongoClient(os.environ["MONGO_URL"])
_db_name = os.environ["DB_NAME"]

scheduler = AsyncIOScheduler(
    jobstores={
        "default": MongoDBJobStore(
            database=_db_name, collection="apscheduler_jobs", client=_sync_client
        )
    },
    timezone="UTC",
)

# Registry of job functions, discoverable by name. Schedulers typically reference
# callables directly, but this registry is useful for ad-hoc triggering from
# REST endpoints ("run now") and for introspection.
JOB_REGISTRY: dict[str, Callable[..., Awaitable[Any]]] = {}


def register_job(name: str) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
    def deco(fn: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        JOB_REGISTRY[name] = fn
        return fn

    return deco


def start_scheduler() -> None:
    """Idempotent start — safe to call repeatedly from startup hooks / reloads."""
    if scheduler.running:
        return
    try:
        scheduler.start()
        logger.info("APScheduler started (jobstore=mongodb, %d jobs persisted)",
                    len(scheduler.get_jobs()))
    except Exception as e:  # noqa: BLE001
        logger.exception("Failed to start APScheduler: %s", e)


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
    try:
        _sync_client.close()
    except Exception:
        pass
