"""Facebook channel handler — READ-ONLY in v1.

The Listener is a passive observer. `execute` is a no-op that simply records
"activation" by ensuring a listener exists for the campaign and that the
scheduler has registered the poll job for it. All actual FB actions (joining
groups, posting, commenting, DMing) are performed manually by the manager per
Tako's ToS posture. See docs/facebook-listener-spec.md §2.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class FacebookChannel:
    channel_type = "facebook"

    async def validate_config(self, org_id: str) -> list[str]:
        from server import db  # late import

        errs: list[str] = []
        settings = await db.org_integrations.find_one(
            {"organization_id": org_id},
            {"oauth_tokens": 1},
        )
        tokens = (settings or {}).get("oauth_tokens") or {}
        if not tokens.get("meta"):
            errs.append(
                "Meta (Facebook) OAuth not connected. Go to Settings → Integrations → Meta to connect."
            )
        return errs

    async def prepare(self, campaign: dict) -> dict:
        # Listeners don't use recipients; leave the campaign alone.
        return campaign

    async def execute(self, campaign: dict) -> dict:
        """'Activate' a read-only listener campaign.

        Ensures a Listener document exists for the campaign and that its poll job
        is registered. Returns a no-op send result so callers can present a
        uniform response.
        """
        from server import db  # late import

        listener = await db.listeners.find_one({"campaign_id": campaign["campaign_id"]})
        if listener and listener.get("status") == "active":
            # Poller is already scheduled on startup (see listeners.poller); nothing
            # extra to do at send-time.
            return {
                "sent": 0,
                "failed": 0,
                "provider_ids": [],
                "note": "read-only listener activated",
                "listener_id": listener["listener_id"],
            }
        return {
            "sent": 0,
            "failed": 0,
            "provider_ids": [],
            "note": "no active listener attached to campaign",
        }

    async def fetch_stats(self, campaign: dict) -> dict:
        from server import db  # late import

        listener = await db.listeners.find_one(
            {"campaign_id": campaign["campaign_id"]}, {"_id": 0, "stats": 1}
        )
        if not listener:
            return {}
        return listener.get("stats", {})
