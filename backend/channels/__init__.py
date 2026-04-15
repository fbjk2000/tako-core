"""Channel handler registry.

Use `get_handler(channel_type)` in `POST /campaigns/{id}/send` to dispatch by
`campaign["channel_type"]`. Unknown channel_type returns None; callers decide
whether to 400 or fall back.
"""

from __future__ import annotations

from typing import Optional

from channels.base import ChannelHandler
from channels.email import EmailChannel
from channels.facebook import FacebookChannel

HANDLERS: dict[str, ChannelHandler] = {
    "email": EmailChannel(),
    "facebook": FacebookChannel(),
    # future: "instagram": InstagramChannel(), "linkedin": LinkedInChannel(),
}


def get_handler(channel_type: str) -> Optional[ChannelHandler]:
    return HANDLERS.get(channel_type or "email")


def known_channel_types() -> list[str]:
    return sorted(HANDLERS.keys())


__all__ = ["HANDLERS", "get_handler", "known_channel_types", "ChannelHandler"]
