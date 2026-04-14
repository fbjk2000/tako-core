"""Channel abstraction: pluggable send/receive handlers per campaign channel_type.

Each handler implements the `ChannelHandler` protocol below. Campaigns dispatch to a
handler based on `campaign["channel_type"]`. Read-only channels (e.g. Facebook
listening) implement `execute` as a no-op because the manager performs the
outbound action manually.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class ChannelHandler(Protocol):
    """Protocol implemented by every channel handler."""

    channel_type: str

    async def validate_config(self, org_id: str) -> list[str]:
        """Return a list of human-readable missing-config errors. Empty list = OK."""
        ...

    async def prepare(self, campaign: dict) -> dict:
        """Normalize recipients, check quotas, etc. Returns the prepared campaign dict."""
        ...

    async def execute(self, campaign: dict) -> dict:
        """Execute the send / activation. Return `{sent, failed, provider_ids}` shape.

        For read-only channels (e.g. Facebook in v1), return a no-op shape:
        `{"sent": 0, "failed": 0, "provider_ids": [], "note": "read-only channel"}`.
        """
        ...

    async def fetch_stats(self, campaign: dict) -> dict:
        """Return provider-side stats (opens, clicks, hits, etc). Best-effort."""
        ...
