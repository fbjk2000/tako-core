"""Meta OAuth routes (authorize + callback).

Separate from the Google flows in server.py (which use a different token store).
Tokens land in `db.org_integrations.oauth_tokens.meta` per the OAuth framework.
"""

from __future__ import annotations

import os
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from oauth import get_provider, store_org_token


def bind_oauth_router(*, get_current_user, ensure_user_org, db):  # noqa: ANN001
    r = APIRouter(prefix="/api/oauth", tags=["oauth"])

    @r.get("/{provider}/authorize-url")
    async def authorize_url(
        provider: str, current_user: dict = Depends(get_current_user)
    ):
        if not current_user.get("organization_id"):
            current_user["organization_id"] = await ensure_user_org(current_user)
        prov = get_provider(provider)
        if not prov:
            raise HTTPException(status_code=404, detail=f"Unknown provider {provider}")
        frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        base_api = os.environ.get("BACKEND_PUBLIC_URL") or frontend
        redirect_uri = f"{base_api}/api/oauth/{provider}/callback"
        state = secrets.token_urlsafe(24)
        await db.oauth_states.update_one(
            {"state": state},
            {
                "$set": {
                    "state": state,
                    "provider": provider,
                    "user_id": current_user["user_id"],
                    "organization_id": current_user["organization_id"],
                }
            },
            upsert=True,
        )
        url = prov.authorize_url(state=state, redirect_uri=redirect_uri)
        return {"auth_url": url, "state": state}

    @r.get("/{provider}/callback")
    async def oauth_callback(
        provider: str,
        code: str = Query(...),
        state: str = Query(...),
    ):
        prov = get_provider(provider)
        if not prov:
            raise HTTPException(status_code=404, detail=f"Unknown provider {provider}")
        state_doc = await db.oauth_states.find_one({"state": state})
        if not state_doc or state_doc.get("provider") != provider:
            raise HTTPException(status_code=400, detail="Invalid state")
        await db.oauth_states.delete_one({"state": state})
        frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        base_api = os.environ.get("BACKEND_PUBLIC_URL") or frontend
        redirect_uri = f"{base_api}/api/oauth/{provider}/callback"
        try:
            tokens = await prov.exchange_code(code=code, redirect_uri=redirect_uri)
        except Exception as e:  # noqa: BLE001
            return RedirectResponse(f"{frontend}?tab=integrations&oauth_error={e}")
        await store_org_token(state_doc["organization_id"], provider, tokens)
        return RedirectResponse(
            f"{frontend}?tab=integrations&{provider}=connected"
        )

    return r
