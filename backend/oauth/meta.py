"""Meta (Facebook) OAuth provider.

Uses the Facebook Graph API v19.0 OAuth endpoints. Requested scopes target the
Phase-1 Listener use case: reading Pages the org already has permissions for
and reading public post metadata. Group content is NOT covered here — that's
the Chrome-extension ingest path (Phase 2).

Submit for Meta app review with `pages_read_engagement` before shipping to
non-internal orgs — Meta's review typically takes weeks. See
docs/facebook-listener-spec.md §6.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from oauth.base import OAuthProvider, OAuthTokens

logger = logging.getLogger(__name__)

META_AUTHORIZE = "https://www.facebook.com/v19.0/dialog/oauth"
META_TOKEN = "https://graph.facebook.com/v19.0/oauth/access_token"


class MetaOAuthProvider:
    name = "meta"
    scopes: list[str] = [
        "public_profile",
        "email",
        "pages_show_list",
        "pages_read_engagement",
    ]

    def __init__(self) -> None:
        self.client_id = os.environ.get("META_APP_ID", "")
        self.client_secret = os.environ.get("META_APP_SECRET", "")

    def authorize_url(self, *, state: str, redirect_uri: str) -> str:
        if not self.client_id:
            raise RuntimeError("META_APP_ID not set — cannot build authorize URL")
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": ",".join(self.scopes),
            "response_type": "code",
        }
        return f"{META_AUTHORIZE}?{urlencode(params)}"

    async def exchange_code(self, *, code: str, redirect_uri: str) -> OAuthTokens:
        if not (self.client_id and self.client_secret):
            raise RuntimeError("META_APP_ID / META_APP_SECRET not set")
        params = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": redirect_uri,
            "code": code,
        }
        async with httpx.AsyncClient(timeout=15) as hc:
            resp = await hc.get(META_TOKEN, params=params)
            resp.raise_for_status()
            data = resp.json()
        expires_at = None
        if data.get("expires_in"):
            expires_at = (
                datetime.now(timezone.utc) + timedelta(seconds=int(data["expires_in"]))
            ).isoformat()
        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=None,  # Meta does not use refresh tokens; use long-lived exchange
            expires_at=expires_at,
            scopes=self.scopes,
            raw=data,
        )

    async def refresh_token(self, *, refresh_token: str) -> OAuthTokens:
        # Meta does not issue refresh tokens. Use fb_exchange_token to extend a
        # short-lived token into a long-lived (~60 day) one. Caller should store
        # access_token as the new refresh_token input.
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "fb_exchange_token": refresh_token,
        }
        async with httpx.AsyncClient(timeout=15) as hc:
            resp = await hc.get(META_TOKEN, params=params)
            resp.raise_for_status()
            data = resp.json()
        expires_at = None
        if data.get("expires_in"):
            expires_at = (
                datetime.now(timezone.utc) + timedelta(seconds=int(data["expires_in"]))
            ).isoformat()
        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=None,
            expires_at=expires_at,
            scopes=self.scopes,
            raw=data,
        )


# --- Signature validation for Meta webhooks (used by webhook_ingest) ---


def validate_meta_signature(body: bytes, signature_header: str | None) -> bool:
    """Validate X-Hub-Signature-256 header: sha256=<hmac>."""
    import hashlib
    import hmac

    secret = os.environ.get("META_APP_SECRET", "")
    if not secret or not signature_header:
        return False
    try:
        algo, digest = signature_header.split("=", 1)
    except ValueError:
        return False
    if algo != "sha256":
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, digest)
