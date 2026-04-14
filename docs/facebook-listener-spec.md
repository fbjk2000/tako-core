# Facebook Listener — Implementation Spec

**Status**: Draft v1
**Author**: Florian Krueger (with Claude)
**Last updated**: 2026-04-14

## 1. Goal

Extend Tako's campaign system beyond email to support **social listening** on Facebook (and later Instagram/LinkedIn). The Listener is a semi-autonomous agent that:

1. Discovers relevant FB groups/pages for a campaign and files them as tasks for the manager to review and join manually.
2. Monitors an ingested stream of posts/comments for trigger keywords and buying signals, classifies them with Claude, and creates tasks for high-confidence matches.
3. Produces a periodic digest report with deep links and pre-filled task drafts.

## 2. Non-goals (ToS boundary — do not cross)

The Listener is **read-only** from Meta's perspective in v1. All of the following stay manual:

- No automated joining of groups.
- No automated posting, commenting, DMing, reacting, or friend requests.
- No headless-browser scraping of Facebook using a Tako-owned session.
- No writing back to Facebook via the Chrome extension.

The extension is a passive observer of pages the manager is already viewing in their own logged-in session.

## 3. Confirmed design decisions

| Decision | Choice |
|---|---|
| Job runner | APScheduler in-process |
| Extension pairing UX | Device code |
| ToS posture | Read-only v1, manager performs all FB actions manually |

## 4. Phased delivery

### Phase 0 — Prerequisite refactors

These unlock Facebook and every later channel. Do not start Phase 1 without them.

#### P1. Channel abstraction on Campaign

**File**: `backend/server.py:332` (Campaign model)

Add field:

```python
channel_type: Literal["email", "facebook", "instagram", "linkedin"] = "email"
```

**Extract**: move the Kit.com + Resend send logic from `server.py:3160–3222` into `backend/channels/email.py` behind this protocol:

```python
# backend/channels/base.py
from typing import Protocol, Any

class ChannelHandler(Protocol):
    channel_type: str
    async def validate_config(self, org_id: str) -> list[str]: ...  # returns missing-config errors
    async def prepare(self, campaign: dict) -> dict: ...           # normalizes recipients, checks quotas
    async def execute(self, campaign: dict) -> dict: ...            # returns {sent, failed, provider_ids}
    async def fetch_stats(self, campaign: dict) -> dict: ...        # opens, clicks, etc.
```

Registry in `backend/channels/__init__.py`:

```python
HANDLERS: dict[str, ChannelHandler] = {
    "email": EmailChannel(),
    # "facebook": FacebookChannel(),  # added in Phase 1 — read-only, execute() is no-op
}
```

`POST /campaigns/{id}/send` becomes a dispatcher on `campaign["channel_type"]`.

**Migration**: one-off script `scripts/migrate_campaigns_add_channel.py` — `update_many({"channel_type": {"$exists": False}}, {"$set": {"channel_type": "email"}})`.

#### P2. Background job runner (APScheduler)

**New file**: `backend/jobs.py`

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.mongodb import MongoDBJobStore

scheduler = AsyncIOScheduler(
    jobstores={"default": MongoDBJobStore(database="tako", collection="apscheduler_jobs", client=motor_client)},
    timezone="UTC",
)

# Registry of job functions, discoverable by name
JOB_REGISTRY: dict[str, callable] = {}

def register_job(name: str):
    def deco(fn):
        JOB_REGISTRY[name] = fn
        return fn
    return deco
```

Wire `scheduler.start()` into the FastAPI lifespan handler. All Listener polling/digest jobs register here.

Jobs defined in Phase 1:
- `listener_poll_meta_pages` — every 30 min per listener
- `listener_generate_digest` — daily or weekly per listener config
- `listener_rescore_hits` — hourly, re-runs classifier on hits older than 24h whose confidence was borderline

#### P3. Generic webhook receiver

**New route**: `POST /webhooks/{provider}/{org_id}` in `backend/server.py`

```python
WEBHOOK_VALIDATORS: dict[str, callable] = {
    "stripe": validate_stripe_signature,  # existing, refactored out of server.py:70
    "meta": validate_meta_signature,
    "chrome_extension": validate_extension_token,
}

@app.post("/webhooks/{provider}/{org_id}")
async def webhook_receiver(provider: str, org_id: str, request: Request):
    validator = WEBHOOK_VALIDATORS.get(provider)
    if not validator:
        raise HTTPException(404)
    payload = await validator(request, org_id)
    await dispatch_webhook(provider, org_id, payload)
    return {"ok": True}
```

#### P4. OAuth provider framework

Generalize `server.py:951–1015` (Google handler) into a `backend/oauth/` module with a provider registry:

```python
OAUTH_PROVIDERS = {
    "google": GoogleOAuthProvider(...),
    "meta": MetaOAuthProvider(...),
    # "linkedin": ...,
}
```

Each provider exposes: `authorize_url()`, `exchange_code()`, `refresh_token()`, `scopes`. Tokens stored encrypted in `org_integrations.oauth_tokens[provider_name]` with structure `{access_token, refresh_token, expires_at, scopes}`.

### Phase 1 — Listener core

#### L1. Mongo collections

```
listeners
  listener_id:      str, PK, "lst_<uuid>"
  organization_id:  str
  campaign_id:      str, FK → campaigns
  channel:          str, one of "facebook" (future: "instagram", "linkedin")
  status:           "active" | "paused" | "archived"
  config:           {
    keywords:       [str],
    negative_keywords: [str],
    personas:       str,                 # free-text persona description for LLM
    languages:      [str],               # ISO codes, filter before classify
    group_allowlist: [str],              # source_ids to include
    group_blocklist: [str],
    cadence:        "15min" | "hourly" | "daily",
    digest_cadence: "daily" | "weekly",
    quiet_hours:    {start: "22:00", end: "07:00", tz: "Europe/Berlin"},
    min_confidence: float                # 0-1, threshold for auto-task creation
  }
  stats:            {hits_total, tasks_created, last_poll_at}
  created_by:       str (user_id)
  created_at, updated_at: datetime

listener_sources
  source_id:        str, PK, "src_<uuid>"
  listener_id:      str, FK
  type:             "fb_page" | "fb_group"
  external_id:      str                  # Meta Page ID, or FB group URL slug
  url:              str
  name:             str
  status:           "pending_review" | "active" | "rejected"
  discovered_by:    "manual" | "discover_agent"
  joined_at:        datetime | None       # set manually by manager when they confirm membership
  last_scanned_at:  datetime
  created_at:       datetime

listener_hits
  hit_id:           str, PK, "hit_<uuid>"
  listener_id:      str, FK
  source_id:        str, FK
  external_post_id: str                  # dedupe key
  url:              str                  # deep link into FB
  author:           {name, profile_url}
  text:             str
  matched_keywords: [str]
  classification:   "buying_signal" | "complaint" | "question" | "mention" | "noise"
  confidence:       float
  sentiment:        "positive" | "neutral" | "negative"
  suggested_reply:  str | None
  acted_on:         bool
  related_task_id:  str | None
  seen_at:          datetime
  classified_at:    datetime

listener_reports
  report_id:        str, PK
  listener_id:      str, FK
  period_start, period_end: datetime
  summary:          {new_sources, total_hits, high_confidence_hits, top_keywords, trend_deltas}
  body_markdown:    str
  delivered_at:     datetime | None

-- unique indexes --
listener_hits: (listener_id, external_post_id)   # dedupe
listener_sources: (listener_id, external_id)
```

#### L2. Pydantic models (add to `backend/server.py` models section ~line 332)

```python
class ListenerConfig(BaseModel):
    keywords: list[str]
    negative_keywords: list[str] = []
    personas: str = ""
    languages: list[str] = ["en"]
    group_allowlist: list[str] = []
    group_blocklist: list[str] = []
    cadence: Literal["15min", "hourly", "daily"] = "hourly"
    digest_cadence: Literal["daily", "weekly"] = "weekly"
    quiet_hours: dict | None = None
    min_confidence: float = 0.7

class Listener(BaseModel):
    listener_id: str
    organization_id: str
    campaign_id: str
    channel: Literal["facebook"]
    status: Literal["active", "paused", "archived"] = "active"
    paused_reason: Optional[str] = None  # system-driven pause cause; null for user pauses
    config: ListenerConfig
    stats: dict = Field(default_factory=dict)
    created_by: str
    created_at: datetime
    updated_at: datetime

class ListenerCreate(BaseModel):
    campaign_id: str
    channel: Literal["facebook"]
    config: ListenerConfig

class ListenerHit(BaseModel):
    hit_id: str
    listener_id: str
    source_id: str
    external_post_id: str
    url: str
    author: dict
    text: str
    matched_keywords: list[str]
    classification: str
    confidence: float
    sentiment: str | None = None
    suggested_reply: str | None = None
    acted_on: bool = False
    related_task_id: str | None = None
    seen_at: datetime
    classified_at: datetime | None = None
```

#### L3. REST API

```
# Listener CRUD
POST   /listeners                               create
GET    /listeners?campaign_id=...               list per org/campaign
GET    /listeners/{listener_id}                 detail with stats
PATCH  /listeners/{listener_id}                 update config/status
DELETE /listeners/{listener_id}                 archive (soft delete)

# Sources (groups/pages the listener watches)
GET    /listeners/{id}/sources
POST   /listeners/{id}/sources                  manually add {type, url}
PATCH  /listeners/{id}/sources/{source_id}      approve/reject/mark-joined
DELETE /listeners/{id}/sources/{source_id}

# Hits (matched posts)
GET    /listeners/{id}/hits?since=&classification=&acted_on=
PATCH  /listeners/{id}/hits/{hit_id}            mark acted_on, attach task_id
POST   /listeners/{id}/hits/{hit_id}/create-task    one-click task creation

# Reports
GET    /listeners/{id}/reports
GET    /listeners/{id}/reports/{report_id}
POST   /listeners/{id}/reports/generate-now     ad-hoc digest

# Discovery (Skill A)
POST   /listeners/{id}/discover                 run discover_groups now
```

#### L4. Agent skills

All three use the existing `tako_ai_text()` helper (`server.py:627–702`).

**Skill A — `discover_groups(listener)`**

Registered as an async function invoked by `POST /listeners/{id}/discover` and by a scheduled job (weekly).

```python
async def discover_groups(listener: dict) -> list[dict]:
    """
    1. Build seed queries from listener.config.keywords + personas
    2. Web search for site:facebook.com/groups/ AND keyword patterns
    3. Pull any Pages already watched by the campaign's lead list (enrich endpoint)
    4. Feed candidates to Claude: 'Rank these groups for relevance to <persona>, <keywords>'
    5. For each candidate with score > 0.6:
       - Create listener_source with status="pending_review", discovered_by="discover_agent"
       - Create a Task: title="Review & join FB group: {name}",
         description={url, why_relevant, rank_score},
         related_campaign_id=listener.campaign_id,
         related_listener_id=listener.listener_id
    """
```

**Skill B — `classify_hit(hit, listener)`**

Invoked synchronously during ingestion, for every new hit.

Prompt template (pseudo):

```
You are classifying Facebook posts for a campaign manager.

Campaign context:
- Target persona: {listener.config.personas}
- Keywords of interest: {listener.config.keywords}
- Negative signals: {listener.config.negative_keywords}

Post:
- Author: {hit.author.name}
- Text: {hit.text}
- Source: {source.type} "{source.name}"

Return strict JSON:
{
  "classification": one of ["buying_signal","complaint","question","mention","noise"],
  "confidence": 0.0-1.0,
  "sentiment": "positive"|"neutral"|"negative",
  "suggested_reply": string or null,   // only if classification != "noise"
  "reasoning": one sentence
}
```

If `confidence >= listener.config.min_confidence` and `classification in {"buying_signal","question","complaint"}`:
- Create task with `related_listener_id`, `related_campaign_id`, deep link in description, suggested reply as draft.
- Set `hit.related_task_id`.

Otherwise: persist hit for the digest only.

**Skill C — `generate_report(listener, period)`**

Scheduled per `listener.config.digest_cadence`.

Aggregates hits in the period, asks Claude to narrate trends, produces markdown body stored in `listener_reports.body_markdown`. Report is displayed in the UI and optionally emailed to `listener.created_by` via the email channel.

#### L5. Meta Graph API ingestion (Phase 1 — Pages only)

**Job**: `listener_poll_meta_pages`, runs per `listener.config.cadence`.

```python
@register_job("listener_poll_meta_pages")
async def poll_meta_pages(listener_id: str):
    listener = await db.listeners.find_one({"listener_id": listener_id})
    org_token = await get_meta_oauth_token(listener["org_id"])
    sources = db.listener_sources.find({
        "listener_id": listener_id,
        "type": "fb_page",
        "status": "active"
    })
    async for source in sources:
        # GET /{page_id}/posts?since={source.last_scanned_at}
        posts = await meta_graph_get(f"/{source['external_id']}/posts", token=org_token, since=source["last_scanned_at"])
        for post in posts:
            # Keyword pre-filter (cheap)
            if not any(kw.lower() in post["message"].lower() for kw in listener["config"]["keywords"]):
                continue
            # Insert hit (dedupe on external_post_id)
            hit = build_hit(listener, source, post)
            try:
                await db.listener_hits.insert_one(hit)
            except DuplicateKeyError:
                continue
            # Classify + maybe create task
            await classify_hit(hit, listener)
        await db.listener_sources.update_one({"source_id": source["source_id"]}, {"$set": {"last_scanned_at": utcnow()}})
```

**Scope limitation**: Only works for Pages the org has access to via Page Public Content Access app review, or Pages the org admins. Group content is NOT covered here — that's Phase 2.

### Phase 2 — Chrome extension for groups

**New repo**: `tako-chrome-extension` (not inside `tako-core`)

**Manifest V3**. Content script on `*.facebook.com/groups/*` and `*.facebook.com/*/posts/*`.

#### Pairing flow (device code)

1. User clicks **Settings → Integrations → Pair Chrome extension** in Tako.
2. Tako generates `{device_code, user_code, expires_at}` and displays `user_code` (e.g., `WXYZ-1234`).
3. User opens extension popup, pastes `user_code`, clicks **Pair**.
4. Extension POSTs `user_code` to `POST /extension/pair/exchange` which returns a long-lived `extension_token` (scoped to org_id).
5. Extension stores token in `chrome.storage.local`.

**Endpoints**:

```
POST /extension/pair/start        → {device_code, user_code, expires_at}    (called by Tako UI)
POST /extension/pair/exchange     → {extension_token, org_id}                (called by extension, body: {user_code})
POST /extension/pair/confirm      → 200                                       (called by Tako UI on the `device_code` after popup shows it — confirms user approval)
DELETE /extension/tokens/{id}     → revoke
```

User flow: UI shows code → user enters in extension → extension calls `exchange` (gets pending) → UI's `confirm` activates the token.

#### Content script behavior

- MutationObserver on the feed container.
- For each newly rendered post:
  - Extract `{post_url, author_name, author_url, text, timestamp}` from stable DOM anchors (wrap in try/except; FB DOM changes — ship with a feature-flag kill switch).
  - POST to `/webhooks/chrome_extension/{org_id}` with `{source_url, posts: [...]}`.
- Throttle: max 1 req/sec per tab, batch up to 20 posts per request.
- Never click, never type, never submit. Never read DMs.

#### Webhook payload

```json
{
  "extension_token": "ext_...",
  "source_url": "https://www.facebook.com/groups/123456789",
  "source_type": "fb_group",
  "source_name": "Founders Berlin",
  "observed_at": "2026-04-14T10:23:00Z",
  "posts": [
    {
      "external_post_id": "fb_post_987",
      "url": "https://www.facebook.com/groups/123456789/posts/987",
      "author": {"name": "Jane Doe", "profile_url": "..."},
      "text": "Anyone recommend a decent CRM for a small agency?",
      "timestamp": "2026-04-14T10:20:00Z"
    }
  ]
}
```

Backend handler: validate token → resolve listener by `source_url` match (auto-create `listener_source` with `status="pending_review"` if unknown) → dedupe and insert hits → trigger classify.

### Phase 3 — Discovery + reports

Mostly code that already exists as Skill A and Skill C stubs in Phase 1. Phase 3 = tuning + UI polish + scheduling the recurring digest job.

### Phase 4 — Instagram / LinkedIn

Reuse P1–P4 + L1–L3. Implement a new `ChannelHandler`, a new OAuth provider, a new poller. Extension content script adds matchers for the respective domains.

## 5. Frontend changes

- `frontend/src/pages/CampaignsPage.jsx`: add channel picker to create-campaign form. When channel is not `email`, show a "Configure Listener" sub-panel instead of recipient list + subject/content.
- **New** `frontend/src/pages/ListenersPage.jsx`: per-listener detail with three tabs — **Sources** (pending/active/rejected), **Hits** (live feed with filters), **Reports**.
- `frontend/src/pages/TasksPage.jsx`: render a "Source: FB — [Group name]" badge on task cards with `related_listener_id`. Clicking opens the FB deep link in a new tab.
- `frontend/src/pages/SettingsPage.jsx` → Integrations: add "Meta" (OAuth button) and "Chrome extension" (device-code pairing) sections.

## 6. Security & compliance checklist

- [ ] Meta OAuth scopes documented and app-review submission drafted (Page Public Content Access is required for Pages polling; do this early, Meta review takes weeks).
- [ ] Extension token scoping: one token per org, revocable, never shared across orgs.
- [ ] Extension bundle is open-source-auditable in the Chrome Web Store listing (builds trust).
- [ ] PII retention: `listener_hits.text` retained 90 days by default, configurable per org.
- [ ] Rate limit ingestion per org to prevent runaway extensions from blowing up costs.
- [ ] Classifier cost cap: skip Claude call if keyword pre-filter score is 0 (i.e., only matched in negative list or by accident).
- [ ] Audit log every task auto-created by Listener with `created_by = "listener:<listener_id>"` so managers can distinguish human vs. agent actions.
- [ ] ToS review document: written record that Tako's Listener does not automate any FB account action; required for legal sign-off.

## 7. Open questions to answer before Phase 1 kickoff

1. Meta app: new dedicated Tako Meta app, or reuse one of the existing apps? (Affects review timeline.)
2. Where should Listener-generated tasks land in the Kanban by default — `todo` or a new `to_review` column?
3. Should high-confidence `buying_signal` hits create a **Lead** (if no matching email exists) in addition to a task? My recommendation: yes, but gated behind a per-listener toggle.
4. Who is the default assignee for Listener-created tasks — `listener.created_by`, or a `default_assignee_id` on the campaign?

## 8. Anchor references in existing code

- Campaign model: `backend/server.py:332–354`
- Campaign send (to refactor): `backend/server.py:3160–3222`
- Task model & CRUD: `backend/server.py:305–320`, `2251–2297`
- AI helper to reuse: `backend/server.py:627–702`
- Org integrations storage: `backend/server.py:2015–2047`
- Google OAuth (to generalize): `backend/server.py:951–1015`
- Stripe webhook (pattern to generalize): `backend/server.py:70–162`
