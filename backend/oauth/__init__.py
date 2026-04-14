"""OAuth provider registry.

The existing Google flows in server.py are not ported here (they use a different
token store — `db.google_calendar_tokens`). New providers store tokens under
`db.org_integrations.oauth_tokens[provider_name]` for org-scoped access by
listener/SMM agents.
"""

from __future__ import annotations

from typing import Optional

from oauth.base import OAuthProvider, OAuthTokens
from oauth.meta import MetaOAuthProvider, validate_meta_signature

OAUTH_PROVIDERS: dict[str, OAuthProvider] = {
    "meta": MetaOAuthProvider(),
}


def get_provider(name: str) -> Optional[OAuthProvider]:
    return OAUTH_PROVIDERS.get(name)


async def get_org_token(org_id: str, provider: str) -> Optional[dict]:
    """Fetch stored OAuth tokens for an org+provider pair. Returns the raw
    `{access_token, refresh_token, expires_at, scopes}` dict or None.
    """
    from server import db  # late import

    settings = await db.org_integrations.find_one(
        {"organization_id": org_id}, {"oauth_tokens": 1}
    )
    tokens = ((settings or {}).get("oauth_tokens") or {}).get(provider)
    return tokens


async def store_org_token(org_id: str, provider: str, tokens: OAuthTokens) -> None:
    from server import db  # late import

    await db.org_integrations.update_one(
        {"organization_id": org_id},
        {
            "$set": {
                "organization_id": org_id,
                f"oauth_tokens.{provider}": {
                    "access_token": tokens.access_token,
                    "refresh_token": tokens.refresh_token,
                    "expires_at": tokens.expires_at,
                    "scopes": tokens.scopes,
                },
            }
        },
        upsert=True,
    )


__all__ = [
    "OAUTH_PROVIDERS",
    "get_provider",
    "get_org_token",
    "store_org_token",
    "validate_meta_signature",
]
