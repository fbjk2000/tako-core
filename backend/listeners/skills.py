"""Three Listener agent skills.

- `discover_groups(listener)` → surface candidate FB groups/pages, file Tasks.
- `classify_hit(hit, listener)` → LLM classification, maybe auto-create Task.
- `generate_report(listener, period)` → weekly/daily digest markdown.

All three use `tako_ai_text` from server.py for LLM calls. LLM output is strict
JSON where relevant; we parse defensively and fall back to "noise" on any
parse error rather than raising, so the polling loop stays robust.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Shared helpers
# ------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of an LLM response. Raises ValueError on failure."""
    text = text.strip()
    # Strip code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("no JSON object found")
    return json.loads(text[start : end + 1])


async def _get_creator_email(created_by: str) -> str:
    """Resolve a user_id to their email (for AI key routing)."""
    from server import db  # late import

    user = await db.users.find_one({"user_id": created_by}, {"email": 1})
    return (user or {}).get("email", "")


# ------------------------------------------------------------------
# Skill B — classify_hit
# ------------------------------------------------------------------

CLASSIFICATION_SYSTEM = """You are a classifier for a B2B campaign manager.

You read a single Facebook post and decide whether it is a buying signal, a
complaint about competitors, a question the campaign could answer, a general
mention, or noise. You also draft a short suggested reply when useful.

Output STRICT JSON. No preamble, no code fences, no trailing text. Keys:
  classification: one of ["buying_signal","complaint","question","mention","noise"]
  confidence:     float 0.0–1.0
  sentiment:      "positive" | "neutral" | "negative"
  suggested_reply: string or null (null if classification == "noise")
  reasoning:      one short sentence
"""


async def classify_hit(hit: dict, listener: dict, source: Optional[dict] = None) -> dict:
    """Classify a hit in place. Persists classification + optional task.

    Returns the updated hit document (without _id).
    """
    from server import db, tako_ai_text  # late import

    cfg = listener.get("config", {})
    source_name = (source or {}).get("name", "")
    source_type = (source or {}).get("type", "")

    user_prompt = (
        f"Campaign context:\n"
        f"- Target persona: {cfg.get('personas') or '(unspecified)'}\n"
        f"- Keywords of interest: {', '.join(cfg.get('keywords', []))}\n"
        f"- Negative signals: {', '.join(cfg.get('negative_keywords', [])) or '(none)'}\n\n"
        f"Post:\n"
        f"- Author: {hit.get('author', {}).get('name', '')}\n"
        f"- Source: {source_type} \"{source_name}\"\n"
        f"- Text: {hit.get('text', '')[:4000]}\n"
    )

    creator_email = await _get_creator_email(listener.get("created_by", ""))
    org_id = listener.get("organization_id")

    try:
        raw = await tako_ai_text(
            CLASSIFICATION_SYSTEM,
            user_prompt,
            user_email=creator_email,
            org_id=org_id,
        )
        parsed = _extract_json(raw)
    except Exception as e:  # noqa: BLE001
        logger.warning("classify_hit parse/LLM error for hit=%s: %s", hit.get("hit_id"), e)
        parsed = {
            "classification": "noise",
            "confidence": 0.0,
            "sentiment": "neutral",
            "suggested_reply": None,
            "reasoning": f"classifier error: {e}",
        }

    classification = parsed.get("classification", "noise")
    confidence = float(parsed.get("confidence", 0.0) or 0.0)
    sentiment = parsed.get("sentiment")
    suggested_reply = parsed.get("suggested_reply")

    updates = {
        "classification": classification,
        "confidence": confidence,
        "sentiment": sentiment,
        "suggested_reply": suggested_reply,
        "classified_at": _utcnow().isoformat(),
    }

    # Auto-task creation gate
    min_conf = float(cfg.get("min_confidence", 0.7))
    task_worthy = classification in {"buying_signal", "question", "complaint"}
    if task_worthy and confidence >= min_conf:
        task_id = await _create_listener_task(hit, listener, classification, suggested_reply)
        updates["related_task_id"] = task_id

    await db.listener_hits.update_one(
        {"hit_id": hit["hit_id"]}, {"$set": updates}
    )
    # Bump listener stats
    await db.listeners.update_one(
        {"listener_id": listener["listener_id"]},
        {"$inc": {"stats.hits_total": 1, **({"stats.tasks_created": 1} if updates.get("related_task_id") else {})}},
    )

    hit.update(updates)
    return hit


async def _create_listener_task(
    hit: dict, listener: dict, classification: str, suggested_reply: Optional[str]
) -> str:
    """Create a Task in Tako for a high-confidence listener hit.

    `created_by` is set to "listener:<id>" so humans can tell agent-created tasks
    from their own (spec §6 checklist).
    """
    from server import db  # late import

    cfg = listener.get("config", {}) or {}
    assignee = cfg.get("default_assignee_id") or listener.get("created_by")
    now = _utcnow()
    author_name = hit.get("author", {}).get("name", "someone")
    title = f"[{classification}] {author_name}: {hit.get('text', '')[:60]}"
    description_parts = [
        f"**Source**: {hit.get('url')}",
        f"**Author**: {author_name}",
        f"**Post**:\n> {hit.get('text', '')[:1500]}",
    ]
    if suggested_reply:
        description_parts.append(f"**Suggested reply**:\n{suggested_reply}")

    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task_doc = {
        "task_id": task_id,
        "organization_id": listener["organization_id"],
        "title": title.strip(),
        "description": "\n\n".join(description_parts),
        "status": "to_review",  # spec §7 Q2 — listener tasks land in a review column
        "priority": "high" if classification == "buying_signal" else "medium",
        "assigned_to": assignee,
        "related_listener_id": listener["listener_id"],
        "related_campaign_id": listener.get("campaign_id"),
        "related_hit_id": hit.get("hit_id"),
        "subtasks": [],
        "comments": [],
        "activity": [
            {
                "action": "created_by_listener",
                "by": f"listener:{listener['listener_id']}",
                "by_name": "Listener agent",
                "at": now.isoformat(),
            }
        ],
        "created_by": f"listener:{listener['listener_id']}",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.tasks.insert_one(task_doc)
    logger.info("Listener %s created task %s from hit %s", listener["listener_id"], task_id, hit.get("hit_id"))
    return task_id


# ------------------------------------------------------------------
# Skill A — discover_groups
# ------------------------------------------------------------------

DISCOVERY_SYSTEM = """You help a B2B campaign manager find relevant Facebook groups and Pages.

Given a persona and a set of keywords, you propose candidate groups/pages that
likely contain this audience. Only propose communities you are confident exist.
Output STRICT JSON. No preamble. Shape:

{
  "candidates": [
    {
      "type": "fb_group" | "fb_page",
      "name": string,
      "url": string,
      "why_relevant": one-sentence rationale,
      "rank_score": float 0.0-1.0
    },
    ...
  ]
}
"""


async def discover_groups(listener: dict) -> list[dict]:
    """Ask Claude to propose FB groups/pages for the listener and file them as
    `pending_review` sources + a Task per candidate above 0.6 score.

    Returns the list of persisted source docs.
    """
    from server import db, tako_ai_text  # late import

    cfg = listener.get("config", {})
    user_prompt = (
        f"Persona: {cfg.get('personas') or '(unspecified)'}\n"
        f"Keywords: {', '.join(cfg.get('keywords', []))}\n"
        f"Languages: {', '.join(cfg.get('languages', ['en']))}\n\n"
        f"Propose 5-10 Facebook groups or Pages where this audience is active.\n"
        f"Be conservative — skip anything you are not confident exists."
    )
    creator_email = await _get_creator_email(listener.get("created_by", ""))
    try:
        raw = await tako_ai_text(
            DISCOVERY_SYSTEM,
            user_prompt,
            user_email=creator_email,
            org_id=listener.get("organization_id"),
        )
        parsed = _extract_json(raw)
    except Exception as e:  # noqa: BLE001
        logger.warning("discover_groups LLM error: %s", e)
        return []

    saved: list[dict] = []
    now = _utcnow().isoformat()
    for cand in parsed.get("candidates", [])[:20]:
        score = float(cand.get("rank_score", 0) or 0)
        if score < 0.6:
            continue
        external_id = _url_to_external_id(cand.get("url", ""))
        if not external_id:
            continue
        source_id = f"src_{uuid.uuid4().hex[:12]}"
        doc = {
            "source_id": source_id,
            "listener_id": listener["listener_id"],
            "type": cand.get("type", "fb_group"),
            "external_id": external_id,
            "url": cand.get("url", ""),
            "name": cand.get("name", ""),
            "status": "pending_review",
            "discovered_by": "discover_agent",
            "last_scanned_at": None,
            "rank_score": score,
            "why_relevant": cand.get("why_relevant", ""),
            "created_at": now,
        }
        try:
            await db.listener_sources.insert_one(doc)
        except Exception as e:  # noqa: BLE001 — likely duplicate key; skip
            logger.debug("skip duplicate source %s: %s", external_id, e)
            continue
        saved.append(doc)
        await _file_discovery_task(listener, doc)

    await db.listeners.update_one(
        {"listener_id": listener["listener_id"]},
        {"$set": {"stats.last_discovery_at": now}},
    )
    return saved


def _url_to_external_id(url: str) -> str:
    """Extract a stable ID from a FB URL for dedupe (group slug or page id)."""
    if not url:
        return ""
    m = re.search(r"facebook\.com/groups/([^/?#]+)", url)
    if m:
        return f"group:{m.group(1)}"
    m = re.search(r"facebook\.com/([^/?#]+)", url)
    if m:
        return f"page:{m.group(1)}"
    return url


async def _file_discovery_task(listener: dict, source: dict) -> None:
    from server import db  # late import

    task_id = f"task_{uuid.uuid4().hex[:12]}"
    now = _utcnow()
    cfg = listener.get("config", {}) or {}
    assignee = cfg.get("default_assignee_id") or listener.get("created_by")
    await db.tasks.insert_one(
        {
            "task_id": task_id,
            "organization_id": listener["organization_id"],
            "title": f"Review & join FB {source['type']}: {source['name']}",
            "description": (
                f"**URL**: {source['url']}\n"
                f"**Why relevant**: {source.get('why_relevant', '')}\n"
                f"**Rank**: {source.get('rank_score', 0):.2f}\n\n"
                "Join the group/page manually, then mark this task done. After joining, "
                "mark the source as `active` in the Listener's Sources tab so polling/"
                "ingestion starts."
            ),
            "status": "to_review",
            "priority": "medium",
            "assigned_to": assignee,
            "related_listener_id": listener["listener_id"],
            "related_campaign_id": listener.get("campaign_id"),
            "related_source_id": source["source_id"],
            "subtasks": [],
            "comments": [],
            "activity": [
                {
                    "action": "created_by_listener",
                    "by": f"listener:{listener['listener_id']}",
                    "by_name": "Listener agent",
                    "at": now.isoformat(),
                }
            ],
            "created_by": f"listener:{listener['listener_id']}",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
    )


# ------------------------------------------------------------------
# Skill C — generate_report
# ------------------------------------------------------------------

REPORT_SYSTEM = """You write a short weekly digest for a campaign manager about
their Facebook Listener activity. Narrate trends, highlight 3-5 top hits by
confidence, and flag anything unusual (spike in complaints, new keywords).

Output markdown only — no JSON, no code fences. Keep it under 400 words."""


async def generate_report(
    listener: dict, period_start: datetime, period_end: datetime
) -> dict:
    """Aggregate hits in the period and produce a markdown report.

    Stores in `listener_reports`. Returns the report doc.
    """
    from server import db, tako_ai_text  # late import

    hits_cursor = db.listener_hits.find(
        {
            "listener_id": listener["listener_id"],
            "seen_at": {"$gte": period_start.isoformat(), "$lte": period_end.isoformat()},
        },
        {"_id": 0},
    ).sort("confidence", -1)
    hits = await hits_cursor.to_list(length=500)

    summary = _summarize_hits(hits)
    top_hits = [
        {
            "url": h.get("url"),
            "text": (h.get("text") or "")[:300],
            "classification": h.get("classification"),
            "confidence": h.get("confidence"),
        }
        for h in hits[:8]
    ]
    prompt = (
        f"Listener for campaign {listener.get('campaign_id')}.\n"
        f"Period: {period_start.date().isoformat()} to {period_end.date().isoformat()}.\n"
        f"Summary stats: {json.dumps(summary)}\n\n"
        f"Top hits (highest confidence first):\n{json.dumps(top_hits, indent=2)[:5000]}\n\n"
        "Write the digest."
    )
    creator_email = await _get_creator_email(listener.get("created_by", ""))
    try:
        body_md = await tako_ai_text(
            REPORT_SYSTEM,
            prompt,
            user_email=creator_email,
            org_id=listener.get("organization_id"),
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("generate_report LLM error: %s", e)
        body_md = (
            f"# Listener digest ({period_start.date()} – {period_end.date()})\n\n"
            f"Total hits: {summary['total_hits']}. LLM narration unavailable ({e})."
        )

    report_id = f"rep_{uuid.uuid4().hex[:12]}"
    doc = {
        "report_id": report_id,
        "listener_id": listener["listener_id"],
        "organization_id": listener.get("organization_id"),
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "summary": summary,
        "body_markdown": body_md,
        "delivered_at": None,
        "created_at": _utcnow().isoformat(),
    }
    await db.listener_reports.insert_one(doc)
    doc.pop("_id", None)
    return doc


def _summarize_hits(hits: list[dict]) -> dict:
    by_class: dict[str, int] = {}
    by_sentiment: dict[str, int] = {}
    kw_counts: dict[str, int] = {}
    high_conf = 0
    for h in hits:
        by_class[h.get("classification", "noise")] = by_class.get(h.get("classification", "noise"), 0) + 1
        s = h.get("sentiment")
        if s:
            by_sentiment[s] = by_sentiment.get(s, 0) + 1
        if (h.get("confidence") or 0) >= 0.7:
            high_conf += 1
        for kw in (h.get("matched_keywords") or []):
            kw_counts[kw] = kw_counts.get(kw, 0) + 1
    top_kw = sorted(kw_counts.items(), key=lambda kv: -kv[1])[:10]
    return {
        "total_hits": len(hits),
        "high_confidence_hits": high_conf,
        "by_classification": by_class,
        "by_sentiment": by_sentiment,
        "top_keywords": top_kw,
    }
