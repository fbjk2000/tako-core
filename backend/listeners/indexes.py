"""Mongo index setup for listener collections.

Called from the FastAPI startup hook. Idempotent — `create_index` is a no-op if
the index already exists with the same spec.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def ensure_indexes() -> None:
    from server import db  # late import

    # Dedupe hits within a listener by external_post_id
    await db.listener_hits.create_index(
        [("listener_id", 1), ("external_post_id", 1)], unique=True
    )
    await db.listener_hits.create_index([("listener_id", 1), ("seen_at", -1)])
    await db.listener_hits.create_index([("listener_id", 1), ("classification", 1)])

    # Sources: one (listener_id, external_id) per listener
    await db.listener_sources.create_index(
        [("listener_id", 1), ("external_id", 1)], unique=True
    )
    await db.listener_sources.create_index([("listener_id", 1), ("status", 1)])

    # Listeners: common lookups
    await db.listeners.create_index([("organization_id", 1), ("status", 1)])
    await db.listeners.create_index([("campaign_id", 1)])

    # Reports
    await db.listener_reports.create_index([("listener_id", 1), ("period_end", -1)])

    # OAuth state (CSRF)
    await db.oauth_states.create_index([("state", 1)], unique=True)

    # Extension pairing
    await db.extension_pair_codes.create_index([("device_code", 1)], unique=True)
    await db.extension_pair_codes.create_index(
        [("expires_at", 1)], expireAfterSeconds=0
    )
    await db.extension_tokens.create_index([("token", 1)], unique=True)
    await db.extension_tokens.create_index([("organization_id", 1)])

    logger.info("Listener indexes ensured")
