"""OAuth provider protocol.

The existing Google (login + calendar) code in server.py is left intact. New
providers (Meta, future LinkedIn) implement this protocol and register in
`oauth/__init__.py` so route handlers can stay provider-agnostic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class OAuthTokens:
    access_token: str
    refresh_token: str | None
    expires_at: str | None  # ISO 8601
    scopes: list[str]
    raw: dict  # provider-native payload for debugging


@runtime_checkable
class OAuthProvider(Protocol):
    name: str
    scopes: list[str]

    def authorize_url(self, *, state: str, redirect_uri: str) -> str:
        """Return the provider's authorization URL the browser should visit."""
        ...

    async def exchange_code(self, *, code: str, redirect_uri: str) -> OAuthTokens:
        """Exchange an authorization code for tokens."""
        ...

    async def refresh_token(self, *, refresh_token: str) -> OAuthTokens:
        """Refresh an expired access token. Raise if the provider does not support refresh."""
        ...
