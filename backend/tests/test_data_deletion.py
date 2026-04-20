"""Unit tests for the Meta data-deletion webhook module.

Mirrors the pattern in ``test_listeners.py``: we stub ``server`` via a
pytest fixture so we can import ``listeners.data_deletion`` without pulling
the full FastAPI app.

Run: ``pytest backend/tests/test_data_deletion.py -v``
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import sys
import types
from unittest.mock import AsyncMock, MagicMock

import pytest


APP_SECRET = "test_secret_xyz"


# ---- Fixtures --------------------------------------------------------------

@pytest.fixture
def fake_server(monkeypatch):
    """Stub ``server`` module so the late import in data_deletion resolves."""
    mod = types.ModuleType("server")
    mod.db = MagicMock()
    mod.db.data_deletion_requests = MagicMock()
    mod.db.data_deletion_requests.insert_one = AsyncMock()
    mod.db.data_deletion_requests.update_one = AsyncMock()
    mod.db.data_deletion_requests.find_one = AsyncMock(return_value=None)
    mod.db.org_integrations = MagicMock()
    mod.db.org_integrations.find = MagicMock()
    mod.db.org_integrations.update_one = AsyncMock()
    mod.db.listeners = MagicMock()
    mod.db.listeners.update_many = AsyncMock()
    monkeypatch.setitem(sys.modules, "server", mod)
    monkeypatch.setenv("META_APP_SECRET", APP_SECRET)
    return mod


# ---- Helpers ---------------------------------------------------------------

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _build_signed_request(payload: dict, secret: str = APP_SECRET) -> str:
    payload_b64 = _b64url(json.dumps(payload).encode("utf-8"))
    sig = hmac.new(secret.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return f"{_b64url(sig)}.{payload_b64}"


# ---- parse_signed_request --------------------------------------------------

def test_parse_valid_signed_request(fake_server):
    from listeners.data_deletion import parse_signed_request

    payload = {"algorithm": "HMAC-SHA256", "user_id": "1234567890", "issued_at": 1700000000}
    signed = _build_signed_request(payload)
    decoded = parse_signed_request(signed, APP_SECRET)
    assert decoded["user_id"] == "1234567890"
    assert decoded["algorithm"] == "HMAC-SHA256"


def test_parse_rejects_bad_signature(fake_server):
    from listeners.data_deletion import parse_signed_request, SignedRequestError

    payload = {"algorithm": "HMAC-SHA256", "user_id": "1234567890"}
    signed = _build_signed_request(payload, secret="wrong_secret")
    with pytest.raises(SignedRequestError, match="signature mismatch"):
        parse_signed_request(signed, APP_SECRET)


def test_parse_rejects_malformed(fake_server):
    from listeners.data_deletion import parse_signed_request, SignedRequestError

    with pytest.raises(SignedRequestError):
        parse_signed_request("no-dot-here", APP_SECRET)
    with pytest.raises(SignedRequestError):
        parse_signed_request("", APP_SECRET)


def test_parse_rejects_missing_user_id(fake_server):
    from listeners.data_deletion import parse_signed_request, SignedRequestError

    payload = {"algorithm": "HMAC-SHA256"}  # no user_id
    signed = _build_signed_request(payload)
    with pytest.raises(SignedRequestError, match="missing user_id"):
        parse_signed_request(signed, APP_SECRET)


def test_parse_rejects_unsupported_algorithm(fake_server):
    from listeners.data_deletion import parse_signed_request, SignedRequestError

    payload = {"algorithm": "PLAIN", "user_id": "42"}
    signed = _build_signed_request(payload)
    with pytest.raises(SignedRequestError, match="unsupported algorithm"):
        parse_signed_request(signed, APP_SECRET)


def test_parse_requires_app_secret(fake_server):
    from listeners.data_deletion import parse_signed_request, SignedRequestError

    payload = {"algorithm": "HMAC-SHA256", "user_id": "42"}
    signed = _build_signed_request(payload)
    with pytest.raises(SignedRequestError, match="META_APP_SECRET not configured"):
        parse_signed_request(signed, app_secret="")


# ---- purge_meta_user_data --------------------------------------------------

def _async_iter(items):
    """Turn a list into an async iterator for Motor-like cursors."""
    async def _gen():
        for it in items:
            yield it
    return _gen()


@pytest.mark.asyncio
async def test_purge_removes_token_and_pauses_listener(fake_server):
    fake_server.db.org_integrations.find.return_value = _async_iter([
        {"_id": "oi1", "organization_id": "org_a", "oauth_tokens": {"meta": {"user_id": "u_42"}}},
        {"_id": "oi2", "organization_id": "org_b", "oauth_tokens": {"meta": {"user_id": "u_42"}}},
    ])
    fake_server.db.org_integrations.update_one.return_value.modified_count = 1
    # Each $unset call above returns modified_count=1 via the default MagicMock,
    # so we pre-load a concrete mock:
    update_one_mock = AsyncMock()
    update_one_mock.side_effect = [
        type("R", (), {"modified_count": 1})(),
        type("R", (), {"modified_count": 1})(),
    ]
    fake_server.db.org_integrations.update_one = update_one_mock

    pause_mock = AsyncMock(return_value=type("R", (), {"modified_count": 3})())
    fake_server.db.listeners.update_many = pause_mock

    from listeners.data_deletion import purge_meta_user_data
    stats = await purge_meta_user_data("u_42", "ddr_test")

    assert stats["tokens_removed"] == 2
    assert stats["listeners_paused"] == 3
    assert stats["affected_orgs"] == 2

    # Audit row should be marked completed.
    audit_update = fake_server.db.data_deletion_requests.update_one.await_args
    assert audit_update is not None
    assert audit_update.args[0] == {"request_id": "ddr_test"}
    set_doc = audit_update.args[1]["$set"]
    assert set_doc["status"] == "completed"
    assert set_doc["purged"] == stats


@pytest.mark.asyncio
async def test_purge_no_matches_is_noop(fake_server):
    fake_server.db.org_integrations.find.return_value = _async_iter([])
    fake_server.db.listeners.update_many = AsyncMock(
        return_value=type("R", (), {"modified_count": 0})()
    )

    from listeners.data_deletion import purge_meta_user_data
    stats = await purge_meta_user_data("u_unknown", "ddr_noop")

    assert stats == {"tokens_removed": 0, "listeners_paused": 0, "affected_orgs": 0}
    # update_many should not even run when there are no affected orgs.
    fake_server.db.listeners.update_many.assert_not_awaited()


@pytest.mark.asyncio
async def test_purge_records_failure_and_reraises(fake_server):
    # Make the cursor raise to force the except-path.
    async def _explode():
        raise RuntimeError("mongo down")
        yield  # unreachable, but marks this a generator

    fake_server.db.org_integrations.find.return_value = _explode()

    from listeners.data_deletion import purge_meta_user_data
    with pytest.raises(RuntimeError, match="mongo down"):
        await purge_meta_user_data("u_42", "ddr_fail")

    audit_update = fake_server.db.data_deletion_requests.update_one.await_args
    set_doc = audit_update.args[1]["$set"]
    assert set_doc["status"] == "failed"
    assert "mongo down" in set_doc["error"]
