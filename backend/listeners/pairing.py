"""Chrome extension device-code pairing flow.

Three endpoints (spec §Phase 2 pairing):

  POST /api/extension/pair/start     ← Tako UI
       returns {device_code, user_code, expires_at}
  POST /api/extension/pair/exchange  ← extension (unauthenticated; validated by user_code)
       body: {user_code} → {pairing_status}
  POST /api/extension/pair/confirm   ← Tako UI (user clicked "I entered the code")
       body: {device_code} → {extension_token, org_id}
  DELETE /api/extension/tokens/{id}  ← revoke

Security posture: the token is only released to the Tako UI caller, never to
the extension itself, which means a malicious extension install cannot obtain a
token without a signed-in Tako user completing the UI confirmation.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _generate_user_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no O/0/I/1 confusion
    return "-".join(
        "".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(2)
    )


class ExchangeRequest(BaseModel):
    user_code: str


class ConfirmRequest(BaseModel):
    device_code: str


def bind_pairing(*, get_current_user, ensure_user_org, db):  # noqa: ANN001
    r = APIRouter(prefix="/api/extension", tags=["extension"])

    @r.post("/pair/start")
    async def pair_start(current_user: dict = Depends(get_current_user)):
        if not current_user.get("organization_id"):
            current_user["organization_id"] = await ensure_user_org(current_user)
        org_id = current_user["organization_id"]
        now = _utcnow()
        doc = {
            "device_code": f"dc_{secrets.token_urlsafe(24)}",
            "user_code": _generate_user_code(),
            "organization_id": org_id,
            "initiated_by": current_user["user_id"],
            "status": "pending",  # pending → claimed → confirmed → expired
            "created_at": now.isoformat(),
            "expires_at": now + timedelta(minutes=10),
        }
        await db.extension_pair_codes.insert_one(doc)
        return {
            "device_code": doc["device_code"],
            "user_code": doc["user_code"],
            "expires_at": doc["expires_at"].isoformat(),
        }

    @r.post("/pair/exchange")
    async def pair_exchange(data: ExchangeRequest):
        """Called by the extension popup. Marks the code as `claimed` and waits
        for the Tako UI to confirm. Extension does NOT get a token from this call.
        """
        doc = await db.extension_pair_codes.find_one({"user_code": data.user_code.upper()})
        if not doc:
            raise HTTPException(status_code=404, detail="Invalid code")
        if doc.get("status") not in ("pending", "claimed"):
            raise HTTPException(status_code=400, detail=f"Code is {doc.get('status')}")
        await db.extension_pair_codes.update_one(
            {"device_code": doc["device_code"]},
            {"$set": {"status": "claimed", "claimed_at": _utcnow().isoformat()}},
        )
        return {"status": "claimed", "org_hint": doc["organization_id"][:8]}

    @r.post("/pair/confirm")
    async def pair_confirm(
        data: ConfirmRequest, current_user: dict = Depends(get_current_user)
    ):
        """Called by Tako UI after the user confirms they entered the code in the
        extension. Issues the long-lived extension_token.
        """
        doc = await db.extension_pair_codes.find_one({"device_code": data.device_code})
        if not doc:
            raise HTTPException(status_code=404, detail="Unknown device_code")
        if doc["initiated_by"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="This pairing was started by someone else")
        if doc["status"] != "claimed":
            raise HTTPException(
                status_code=400,
                detail=f"Extension has not entered the code yet (status={doc['status']})",
            )
        token = f"ext_{secrets.token_urlsafe(32)}"
        now = _utcnow()
        await db.extension_tokens.insert_one(
            {
                "token": token,
                "organization_id": doc["organization_id"],
                "created_by": current_user["user_id"],
                "created_at": now.isoformat(),
                "last_used_at": None,
            }
        )
        await db.extension_pair_codes.update_one(
            {"device_code": data.device_code}, {"$set": {"status": "confirmed"}}
        )
        return {"extension_token": token, "organization_id": doc["organization_id"]}

    @r.get("/tokens")
    async def list_tokens(current_user: dict = Depends(get_current_user)):
        org_id = current_user.get("organization_id")
        if not org_id:
            return []
        cursor = db.extension_tokens.find(
            {"organization_id": org_id}, {"_id": 0, "token": 0}
        ).sort("created_at", -1)
        return await cursor.to_list(length=100)

    @r.delete("/tokens/{token_id}")
    async def revoke_token(token_id: str, current_user: dict = Depends(get_current_user)):
        org_id = current_user.get("organization_id")
        result = await db.extension_tokens.delete_one(
            {"token": token_id, "organization_id": org_id}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Token not found")
        return {"message": "Revoked"}

    return r


async def validate_extension_token(db, token: str) -> Optional[dict]:
    """Return the token doc if valid, else None. Updates last_used_at."""
    doc = await db.extension_tokens.find_one({"token": token}, {"_id": 0})
    if not doc:
        return None
    await db.extension_tokens.update_one(
        {"token": token}, {"$set": {"last_used_at": _utcnow().isoformat()}}
    )
    return doc
