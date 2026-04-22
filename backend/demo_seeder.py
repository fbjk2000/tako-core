"""Demo data seeder for the self-serve 14-day demo system (Prompt 9).

Populates a freshly-created demo organization with realistic sample CRM
records so prospects see a lived-in workspace instead of an empty one the
moment they land on the dashboard.

Every record written by this module carries ``is_demo_data: True``. That flag
is NOT removed on demo→paid conversion — customers can keep or delete the
sample data themselves via the normal delete flows.

This file is platform-only (tako.software) and is stripped from the
customer distribution by ``scripts/build-distribution.sh``. Keep the filename
``demo_seeder.py`` so the build script's exclusion rule can find it.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def _iso(dt: datetime) -> str:
    """Store timestamps as ISO strings — matches the convention used by
    create_lead / create_deal / etc. so the seeded records look identical to
    ones the user would create themselves."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


# ── Contacts / Leads ────────────────────────────────────────────────────────
# European names + companies. Staggered created_at over the last 30 days so
# "Recently added" widgets have something reasonable to show.
_LEAD_FIXTURES: List[Dict[str, Any]] = [
    {
        "first_name": "Anna", "last_name": "Bergmann",
        "email": "anna@techcorp.de", "phone": "+49 30 1234567",
        "company": "TechCorp GmbH", "role": "VP Sales",
        "status": "customer",
        "tags": ["enterprise", "dach"],
        "notes": "Signed full platform deal in Q1. Reference customer.",
        "created_days_ago": 28,
        "last_activity_days_ago": 2,
    },
    {
        "first_name": "Pierre", "last_name": "Dubois",
        "email": "pierre@dataflow.fr", "phone": "+33 1 44 55 66 77",
        "company": "DataFlow SAS", "role": "CTO",
        "status": "proposal",
        "tags": ["ai-integration", "france"],
        "notes": "AI integration proposal sent 3 days ago. Follow up this week.",
        "created_days_ago": 21,
        "last_activity_days_ago": 3,
    },
    {
        "first_name": "James", "last_name": "Fletcher",
        "email": "james@meridian.co.uk", "phone": "+44 20 7946 0123",
        "company": "Meridian Ltd", "role": "Head of Ops",
        "status": "new",
        "tags": ["uk", "inbound"],
        "notes": "Inbound lead from the website. Scheduling discovery call.",
        "created_days_ago": 4,
        "last_activity_days_ago": 1,
    },
    {
        "first_name": "Sofia", "last_name": "Rossi",
        "email": "sofia@innoverde.it", "phone": "+39 02 1234 5678",
        "company": "InnoVerde S.r.l.", "role": "CEO",
        "status": "negotiation",
        "tags": ["enterprise", "italy", "hot"],
        "notes": "Full platform deal in final negotiation. Pricing agreed, legal review.",
        "created_days_ago": 18,
        "last_activity_days_ago": 1,
    },
    {
        "first_name": "Lars", "last_name": "Eriksson",
        "email": "lars@nordtech.se", "phone": "+46 8 123 45 67",
        "company": "NordTech AB", "role": "Director",
        "status": "contacted",
        "tags": ["nordics", "pilot"],
        "notes": "Interested in a pilot. Sending contract next week.",
        "created_days_ago": 12,
        "last_activity_days_ago": 5,
    },
    {
        "first_name": "Maria", "last_name": "Santos",
        "email": "maria@iberiadigital.es", "phone": "+34 91 123 45 67",
        "company": "Iberia Digital S.L.", "role": "CMO",
        "status": "qualified",
        "tags": ["iberia", "marketing-led"],
        "notes": "Qualified on the discovery call. Demo booked for next Tuesday.",
        "created_days_ago": 9,
        "last_activity_days_ago": 2,
    },
    {
        "first_name": "Katrin", "last_name": "Huber",
        "email": "katrin@alpenstahl.at", "phone": "+43 1 234 5678",
        "company": "AlpenStahl AG", "role": "Procurement",
        "status": "won",
        "tags": ["dach", "past-customer"],
        "notes": "Closed Won in Q4. Now looking at expanding seats.",
        "created_days_ago": 25,
        "last_activity_days_ago": 7,
    },
    {
        "first_name": "Willem", "last_name": "de Vries",
        "email": "willem@cloudbridge.nl", "phone": "+31 20 123 4567",
        "company": "CloudBridge B.V.", "role": "Founder",
        "status": "lost",
        "tags": ["benelux", "budget"],
        "notes": "Lost to budget constraints. Revisit in 6 months.",
        "created_days_ago": 30,
        "last_activity_days_ago": 15,
    },
]


# ── Deals ───────────────────────────────────────────────────────────────────
# Linked to the lead fixtures above by the email field. (We stitch lead_id
# into each deal after insertion so the relational link mirrors what
# create_deal would do.)
_DEAL_FIXTURES: List[Dict[str, Any]] = [
    {
        "title": "TechCorp CRM Migration",
        "value": 25000, "currency": "EUR",
        "stage": "Closed Won",
        "lead_email": "anna@techcorp.de",
        "expected_close_days": -14,  # already closed
        "probability": 100,
    },
    {
        "title": "DataFlow AI Integration",
        "value": 15000, "currency": "EUR",
        "stage": "Proposal",
        "lead_email": "pierre@dataflow.fr",
        "expected_close_days": 14,
        "probability": 60,
    },
    {
        "title": "Meridian Sales Suite",
        "value": 8000, "currency": "EUR",
        "stage": "Lead",
        "lead_email": "james@meridian.co.uk",
        "expected_close_days": 45,
        "probability": 20,
    },
    {
        "title": "InnoVerde Full Platform",
        "value": 35000, "currency": "EUR",
        "stage": "Negotiation",
        "lead_email": "sofia@innoverde.it",
        "expected_close_days": 7,
        "probability": 80,
    },
    {
        "title": "NordTech Pilot",
        "value": 5000, "currency": "EUR",
        "stage": "Qualified",
        "lead_email": "lars@nordtech.se",
        "expected_close_days": 30,
        "probability": 40,
    },
    {
        "title": "CloudBridge Expansion",
        "value": 20000, "currency": "EUR",
        "stage": "Closed Lost",
        "lead_email": "willem@cloudbridge.nl",
        "expected_close_days": -5,
        "probability": 0,
    },
]


# ── Pipeline ────────────────────────────────────────────────────────────────
_DEFAULT_PIPELINE_STAGES = [
    {"id": "lead",         "name": "Lead",         "order": 0, "color": "#94a3b8"},
    {"id": "qualified",    "name": "Qualified",    "order": 1, "color": "#60a5fa"},
    {"id": "proposal",     "name": "Proposal",     "order": 2, "color": "#a78bfa"},
    {"id": "negotiation",  "name": "Negotiation",  "order": 3, "color": "#f59e0b"},
    {"id": "closed_won",   "name": "Closed Won",   "order": 4, "color": "#10b981"},
    {"id": "closed_lost",  "name": "Closed Lost",  "order": 5, "color": "#ef4444"},
]


# ── Tasks ───────────────────────────────────────────────────────────────────
_TASK_FIXTURES: List[Dict[str, Any]] = [
    {
        "title": "Follow up with Pierre re: AI integration proposal",
        "description": "He asked for clarification on the integration timeline.",
        "due_days_from_now": 1,
        "priority": "high",
        "status": "pending",
        "related_lead_email": "pierre@dataflow.fr",
    },
    {
        "title": "Prepare demo for InnoVerde team",
        "description": "Full platform walkthrough — CEO + CTO + Head of Sales attending.",
        "due_days_from_now": 3,
        "priority": "high",
        "status": "pending",
        "related_lead_email": "sofia@innoverde.it",
    },
    {
        "title": "Send contract to NordTech",
        "description": "Pilot agreement, 6-month term. Legal already approved the template.",
        "due_days_from_now": -2,  # overdue
        "priority": "urgent",
        "status": "pending",
        "related_lead_email": "lars@nordtech.se",
    },
    {
        "title": "Review Q2 pipeline with team",
        "description": "Stage-by-stage review, focus on stalled deals.",
        "due_days_from_now": 7,
        "priority": "medium",
        "status": "pending",
        "related_lead_email": None,
    },
    {
        "title": "Update Meridian contact info after call",
        "description": "James gave a direct dial + mentioned a new PO contact.",
        "due_days_from_now": 0,  # due today
        "priority": "low",
        "status": "pending",
        "related_lead_email": "james@meridian.co.uk",
    },
]


# ── Campaign ────────────────────────────────────────────────────────────────
_CAMPAIGN_FIXTURE = {
    "name": "Q2 Product Update",
    "subject": "What's new in TAKO — Q2 highlights",
    "body": (
        "Hi {{first_name}},\n\n"
        "A quick roundup of what shipped this quarter:\n\n"
        "• AI-drafted follow-ups from any deal card\n"
        "• Redesigned pipeline board with forecast totals\n"
        "• Two-way Google Calendar sync\n"
        "• Invoice PDFs with per-country VAT treatment\n\n"
        "Want a walkthrough? Reply to this email and we'll set something up.\n\n"
        "— The TAKO team"
    ),
    "status": "draft",
}


async def seed_demo_data(db, organization_id: str, user_id: str) -> Dict[str, int]:
    """Insert the fixture set above into Mongo for the given demo org.

    Called from POST /api/demo/create immediately after the org is written.
    Idempotency is NOT a goal — each demo gets its own org and this function
    only ever runs once per org at creation time. Failures raise so the
    endpoint can surface the error rather than hand back an empty org.

    Returns a small counts dict useful for logging and for the endpoint
    response's "welcome" payload.
    """
    now = datetime.now(timezone.utc)

    # 1) Leads — write first so deals + tasks can reference them by id.
    email_to_lead_id: Dict[str, str] = {}
    lead_docs = []
    for fx in _LEAD_FIXTURES:
        lead_id = f"lead_{uuid.uuid4().hex[:12]}"
        email_to_lead_id[fx["email"]] = lead_id
        created_at = now - timedelta(days=fx["created_days_ago"])
        last_activity = now - timedelta(days=fx["last_activity_days_ago"])
        lead_docs.append({
            "lead_id": lead_id,
            "organization_id": organization_id,
            "first_name": fx["first_name"],
            "last_name": fx["last_name"],
            "name": f"{fx['first_name']} {fx['last_name']}",
            "email": fx["email"],
            "phone": fx["phone"],
            "company": fx["company"],
            "role": fx["role"],
            "status": fx["status"],
            "tags": fx["tags"],
            "notes": fx["notes"],
            "source": "demo_seed",
            "assigned_to": user_id,
            "created_by": user_id,
            "created_at": _iso(created_at),
            "updated_at": _iso(last_activity),
            "last_activity_at": _iso(last_activity),
            "is_demo_data": True,
        })
    if lead_docs:
        await db.leads.insert_many(lead_docs)

    # 2) Deals — link each to its lead by email→lead_id map from step 1.
    deal_docs = []
    for fx in _DEAL_FIXTURES:
        deal_id = f"deal_{uuid.uuid4().hex[:12]}"
        lead_id = email_to_lead_id.get(fx["lead_email"])
        expected_close = now + timedelta(days=fx["expected_close_days"])
        deal_docs.append({
            "deal_id": deal_id,
            "organization_id": organization_id,
            "title": fx["title"],
            "value": fx["value"],
            "currency": fx["currency"],
            "stage": fx["stage"],
            "probability": fx["probability"],
            "lead_id": lead_id,
            "contact_email": fx["lead_email"],
            "expected_close_date": _iso(expected_close),
            "assigned_to": user_id,
            "created_by": user_id,
            "created_at": _iso(now - timedelta(days=fx.get("created_days_ago", 10))),
            "updated_at": _iso(now - timedelta(days=1)),
            "is_demo_data": True,
        })
    if deal_docs:
        await db.deals.insert_many(deal_docs)

    # 3) Default pipeline — pipelines live on the org document's `pipelines`
    #    array (not a separate collection). Mirrors POST /organizations/pipelines.
    pipeline_id = f"pipeline_{uuid.uuid4().hex[:8]}"
    await db.organizations.update_one(
        {"organization_id": organization_id},
        {"$push": {"pipelines": {
            "pipeline_id": pipeline_id,
            "name": "Sales Pipeline",
            "stages": _DEFAULT_PIPELINE_STAGES,
            "is_default": True,
            "created_at": _iso(now),
            "is_demo_data": True,
        }}}
    )

    # 4) Tasks — due dates staggered (overdue, today, tomorrow, +3d, +7d).
    task_docs = []
    for fx in _TASK_FIXTURES:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        due = now + timedelta(days=fx["due_days_from_now"])
        related_lead_id = None
        if fx.get("related_lead_email"):
            related_lead_id = email_to_lead_id.get(fx["related_lead_email"])
        task_docs.append({
            "task_id": task_id,
            "organization_id": organization_id,
            "title": fx["title"],
            "description": fx["description"],
            "due_date": _iso(due),
            "priority": fx["priority"],
            "status": fx["status"],
            "related_lead_id": related_lead_id,
            "assigned_to": user_id,
            "created_by": user_id,
            "created_at": _iso(now - timedelta(days=2)),
            "updated_at": _iso(now),
            "is_demo_data": True,
        })
    if task_docs:
        await db.tasks.insert_many(task_docs)

    # 5) Draft email campaign — subject/body filled, status=draft, never sent.
    #    Collection is `campaigns` (matches POST /campaigns handler).
    campaign_id = f"campaign_{uuid.uuid4().hex[:12]}"
    await db.campaigns.insert_one({
        "campaign_id": campaign_id,
        "organization_id": organization_id,
        "name": _CAMPAIGN_FIXTURE["name"],
        "subject": _CAMPAIGN_FIXTURE["subject"],
        "body": _CAMPAIGN_FIXTURE["body"],
        "status": _CAMPAIGN_FIXTURE["status"],
        "recipient_filter": {"tags": []},
        "sent_count": 0,
        "open_count": 0,
        "click_count": 0,
        "created_by": user_id,
        "created_at": _iso(now),
        "updated_at": _iso(now),
        "is_demo_data": True,
    })

    counts = {
        "leads": len(lead_docs),
        "deals": len(deal_docs),
        "pipelines": 1,
        "tasks": len(task_docs),
        "campaigns": 1,
    }
    logger.info(
        "[demo-seed] org=%s user=%s seeded %s", organization_id, user_id, counts
    )
    return counts
