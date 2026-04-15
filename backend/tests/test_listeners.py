"""Unit tests for listener skills (LLM + DB mocked).

Run: `pytest backend/tests/test_listeners.py -v`

These tests intentionally avoid pulling the full `server.py` module (which needs
MONGO_URL in env). We patch the late imports inside skills.py directly.
"""

from __future__ import annotations

import json
import sys
import types
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture
def fake_server(monkeypatch):
    """Install a stub `server` module in sys.modules so skills' `from server import ...` resolves."""
    mod = types.ModuleType("server")
    mod.db = MagicMock()
    mod.db.listener_hits.update_one = AsyncMock()
    mod.db.listeners.update_one = AsyncMock()
    mod.db.tasks.insert_one = AsyncMock()
    mod.db.listener_sources.insert_one = AsyncMock()
    mod.db.listener_reports.insert_one = AsyncMock()
    mod.db.users.find_one = AsyncMock(return_value={"email": "florian@unyted.world"})
    mod.tako_ai_text = AsyncMock(return_value="")
    monkeypatch.setitem(sys.modules, "server", mod)
    return mod


def _listener():
    return {
        "listener_id": "lst_test",
        "organization_id": "org_test",
        "campaign_id": "campaign_test",
        "channel": "facebook",
        "status": "active",
        "created_by": "user_test",
        "config": {
            "keywords": ["crm", "tako"],
            "negative_keywords": [],
            "personas": "small-agency founders",
            "languages": ["en"],
            "min_confidence": 0.7,
            "auto_create_lead_on_buying_signal": False,
        },
    }


def _hit(text: str = "Looking for a CRM for my small agency"):
    return {
        "hit_id": "hit_test",
        "listener_id": "lst_test",
        "source_id": "src_test",
        "external_post_id": "fb_123",
        "url": "https://www.facebook.com/groups/x/posts/123",
        "author": {"name": "Jane Doe", "profile_url": ""},
        "text": text,
        "matched_keywords": ["crm"],
        "classification": "noise",
        "confidence": 0.0,
    }


@pytest.mark.asyncio
async def test_classify_hit_high_confidence_creates_task(fake_server):
    from listeners.skills import classify_hit

    fake_server.tako_ai_text.return_value = json.dumps(
        {
            "classification": "buying_signal",
            "confidence": 0.92,
            "sentiment": "positive",
            "suggested_reply": "Happy to show you TAKO.",
            "reasoning": "explicit purchase intent",
        }
    )
    hit = _hit()
    result = await classify_hit(hit, _listener(), {"name": "Founders", "type": "fb_group"})
    assert result["classification"] == "buying_signal"
    assert result["confidence"] == 0.92
    fake_server.db.tasks.insert_one.assert_called_once()
    task_doc = fake_server.db.tasks.insert_one.call_args[0][0]
    assert task_doc["status"] == "to_review"
    assert task_doc["related_listener_id"] == "lst_test"
    assert task_doc["created_by"] == "listener:lst_test"


@pytest.mark.asyncio
async def test_classify_hit_low_confidence_no_task(fake_server):
    from listeners.skills import classify_hit

    fake_server.tako_ai_text.return_value = json.dumps(
        {
            "classification": "mention",
            "confidence": 0.4,
            "sentiment": "neutral",
            "suggested_reply": None,
            "reasoning": "tangential mention",
        }
    )
    hit = _hit("someone mentioned CRMs in passing")
    result = await classify_hit(hit, _listener(), None)
    assert result["classification"] == "mention"
    fake_server.db.tasks.insert_one.assert_not_called()


@pytest.mark.asyncio
async def test_classify_hit_llm_error_falls_back_to_noise(fake_server):
    from listeners.skills import classify_hit

    fake_server.tako_ai_text.side_effect = RuntimeError("Anthropic down")
    result = await classify_hit(_hit(), _listener(), None)
    assert result["classification"] == "noise"
    assert result["confidence"] == 0.0
    fake_server.db.tasks.insert_one.assert_not_called()


@pytest.mark.asyncio
async def test_classify_hit_malformed_json_falls_back(fake_server):
    from listeners.skills import classify_hit

    fake_server.tako_ai_text.return_value = "not json at all, lol"
    result = await classify_hit(_hit(), _listener(), None)
    assert result["classification"] == "noise"


def test_url_to_external_id_group():
    from listeners.skills import _url_to_external_id

    assert (
        _url_to_external_id("https://www.facebook.com/groups/founders-berlin/")
        == "group:founders-berlin"
    )


def test_url_to_external_id_page():
    from listeners.skills import _url_to_external_id

    assert _url_to_external_id("https://www.facebook.com/taksoftware") == "page:taksoftware"


def test_url_to_external_id_empty():
    from listeners.skills import _url_to_external_id

    assert _url_to_external_id("") == ""


def test_extract_json_with_code_fences():
    from listeners.skills import _extract_json

    text = '```json\n{"x": 1}\n```'
    assert _extract_json(text) == {"x": 1}


def test_extract_json_with_preamble():
    from listeners.skills import _extract_json

    text = 'Sure, here you go: {"classification": "noise", "confidence": 0.1}'
    assert _extract_json(text)["classification"] == "noise"


def test_extract_json_invalid_raises():
    from listeners.skills import _extract_json

    with pytest.raises(ValueError):
        _extract_json("nope")


@pytest.mark.asyncio
async def test_discover_groups_files_candidates(fake_server):
    from listeners.skills import discover_groups

    fake_server.tako_ai_text.return_value = json.dumps(
        {
            "candidates": [
                {
                    "type": "fb_group",
                    "name": "Agency Founders",
                    "url": "https://www.facebook.com/groups/agency-founders",
                    "why_relevant": "target persona",
                    "rank_score": 0.85,
                },
                {
                    "type": "fb_group",
                    "name": "Random",
                    "url": "https://www.facebook.com/groups/random",
                    "why_relevant": "maybe",
                    "rank_score": 0.3,  # below threshold
                },
            ]
        }
    )
    saved = await discover_groups(_listener())
    assert len(saved) == 1
    assert saved[0]["status"] == "pending_review"
    # One source insert + one discovery-review task insert
    assert fake_server.db.listener_sources.insert_one.call_count == 1
    assert fake_server.db.tasks.insert_one.call_count == 1


@pytest.mark.asyncio
async def test_summarize_hits_counts_buckets():
    from listeners.skills import _summarize_hits

    hits = [
        {"classification": "buying_signal", "sentiment": "positive", "confidence": 0.9, "matched_keywords": ["crm"]},
        {"classification": "noise", "sentiment": "neutral", "confidence": 0.1, "matched_keywords": []},
        {"classification": "buying_signal", "sentiment": "positive", "confidence": 0.75, "matched_keywords": ["crm", "tako"]},
    ]
    summary = _summarize_hits(hits)
    assert summary["total_hits"] == 3
    assert summary["high_confidence_hits"] == 2
    assert summary["by_classification"]["buying_signal"] == 2
    assert dict(summary["top_keywords"])["crm"] == 2
