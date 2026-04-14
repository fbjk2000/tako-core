"""Email channel handler.

Thin wrapper around the existing Kit.com + Resend send logic in server.py. We do
NOT reimplement the send flow here (the monolith's version is battle-tested and
env-var wired). Instead we delegate through `execute` so the dispatcher in
`POST /campaigns/{id}/send` can stay polymorphic.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class EmailChannel:
    channel_type = "email"

    async def validate_config(self, org_id: str) -> list[str]:
        # Either platform env or org-level keys qualify.
        from server import db  # late import avoids circular

        errs: list[str] = []
        if os.environ.get("KIT_API_SECRET") or os.environ.get("RESEND_API_KEY"):
            return errs
        settings = await db.org_integrations.find_one(
            {"organization_id": org_id},
            {"kit_api_secret": 1, "resend_api_key": 1},
        )
        if not settings or not (settings.get("kit_api_secret") or settings.get("resend_api_key")):
            errs.append(
                "No email provider configured. Add a Kit.com secret or Resend API key in Settings → Integrations."
            )
        return errs

    async def prepare(self, campaign: dict) -> dict:
        recipients = [r.strip() for r in campaign.get("recipients", []) if r and "@" in r]
        campaign["recipients"] = recipients
        return campaign

    async def execute(self, campaign: dict) -> dict:
        """Delegate to the existing send pipeline in server.py.

        We import lazily to avoid pulling the entire monolith at module load time
        and to keep the dispatcher side free of any email-provider coupling.
        """
        from server import send_campaign_via_kit_internal  # helper we expose in server.py

        return await send_campaign_via_kit_internal(campaign)

    async def fetch_stats(self, campaign: dict) -> dict:
        # Kit.com/Resend stats aren't polled today; surface what's stored.
        return {
            "sent_count": campaign.get("sent_count", 0),
            "open_count": campaign.get("open_count", 0),
            "click_count": campaign.get("click_count", 0),
        }
