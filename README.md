# TAKO — AI-Native CRM

<p align="center">
  <img src="frontend/public/logo-horizontal.svg" alt="TAKO" height="50" />
</p>

<p align="center">
  <strong>The CRM that runs your marketing and sales. Built for European teams that want results, not complexity.</strong>
</p>

<p align="center">
  <a href="https://tako.software">tako.software</a> •
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Environment Variables</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#integrations">Integrations</a>
</p>

---

## Features

### Core CRM
- **Leads** — Import via CSV, manual creation, AI enrichment & scoring, bulk operations, column visibility, business card capture
- **Contacts** — Convert from qualified leads, rich profiles (budget, timeline, decision maker, pain points)
- **Deals** — Kanban pipeline with drag-and-drop + list view, entity linking (Lead/Contact/Company), lost deals excluded from pipeline
- **Tasks** — Kanban drag-and-drop + list view, subtasks/checklists, comments, activity history, stale indicators, project linking, search + multi-filter bar
- **Projects** — Group tasks under deals, progress tracking, clickable task detail from project context, auto-created chat channels, team members
- **Companies** — Target company management with industry, size, and contact tracking
- **Calendar** — Month/Week views with scheduled calls, task due dates, deal closes, custom events with entity linking, Google Calendar sync
- **Campaigns** — Multi-channel (Email via Resend + Kit.com, Facebook, Instagram, LinkedIn), AI-powered email drafting, channel picker on create, social campaigns linked to Listeners
- **Listeners** — AI social listening agents: keyword monitoring, Claude-powered hit classification (buying signal / complaint / question / mention / noise), confidence scoring, sentiment, suggested replies, auto task creation, digest reports, Meta Graph poller, Chrome extension device-code pairing
- **Files** — File upload with AI summarisation (PDF, DOCX, text, images), linked to any entity, one-click task creation from AI suggestions

### AI Features (Claude)
- **Lead Scoring** — AI assigns a 1–100 quality score based on profile completeness and signals
- **Lead Enrichment** — Fills in company info, tech stack, interests, recommended sales approach
- **Email Drafting** — Personalised sales emails with tone/purpose selection
- **Lead Summary** — Comprehensive AI profile analysis
- **Smart Search** — Natural language search across all CRM data
- **Call Analysis** — AI feedback on recorded calls (score, strengths, improvements, next steps)
- **File Analysis** — Auto-summary and follow-up task suggestions on uploaded documents
- **Hit Classification** — Claude classifies social Listener hits in real time: category, confidence, sentiment, suggested reply
- **Digest Reports** — AI-generated daily/weekly summaries of Listener activity with recommended actions
- **Access Control** — Internal team (Fintery, TAKO, AIOS, Unyted, OpenClaw, floriankrueger.com) always use the platform key. New external organizations get a **30-day free AI trial** on the platform key; afterwards they supply their own Anthropic API key in Settings → Integrations. Trial length is configurable via `AI_TRIAL_DAYS`.

### Communication
- **Outbound Calling** — Twilio integration for direct calls from the CRM
- **Inbound Calls** — Auto-greeting, voicemail recording, caller identification
- **Call Scheduling** — Calendar-based scheduling with configurable reminders
- **Google Calendar** — OAuth integration, two-way sync, events displayed in calendar view
- **Team Chat** — Real-time messaging with channels: General, Lead, Deal, Project
- **Chat Archive** — Admins can archive channels, collapsible sidebar sections
- **Capture** — Live camera (getUserMedia) or file upload for business card scanning and lead creation

### Social Listening (Listeners)
- **Listener** — Per-campaign agent monitoring Facebook groups/pages for keyword matches
- **Sources** — Discover, approve, and manage group/page sources; `discover_groups` agent skill files tasks for human review
- **Hits** — Ingested posts/comments classified by Claude with confidence, sentiment, matched keywords, suggested reply
- **Reports** — AI digest with top hits, trends, and recommended actions (`generate_report` skill)
- **Pairing** — Chrome extension device-code pairing (token only issued to UI, never to extension)
- **Poller** — APScheduler jobs: `listener_poll_meta_pages` (per cadence), `listener_generate_digest` (daily/weekly), `listener_rescore_hits` (hourly)
- **Webhooks** — Generic receiver at `/api/webhooks/{provider}/{org_id}` for Meta and Chrome extension payloads

### Platform
- **Multi-tenant Organizations** — Roles: member, admin, owner, deputy_admin, support, super_admin
- **Per-org Integrations** — Each org manages their own API keys (Resend, Kit, Twilio, Google, Anthropic, Meta)
- **Customizable Stages** — Admins can add/remove/rename deal stages and task steps per org
- **Auto Org Attribution** — Users with company emails auto-join matching organizations
- **License Management** — Super admin can override max user limits per organization
- **Team Invitations** — Invite via link, email, or CSV import
- **Multi-level Affiliate Program** — 3 tiers (Partner/Ambassador/Advocate), 20% customer discount, up to 60% commission chain
- **UNYT Token Payments** — Pay with UNYT on Arbitrum via MetaMask
- **PWA** — Installable on iOS, Android, and desktop
- **i18n** — English and German language support with toggle
- **API Keys and Webhooks** — Programmatic access for n8n, Notion, Zapier, and custom integrations
- **Data Explorer** — Super admin can browse all MongoDB collections
- **Reporting Engine** — User performance, pipeline forecasts, activity logs, CSV export
- **Subscription and Billing** — Stripe integration with discount codes and invoicing
- **Onboarding & Support** — In-app onboarding checklist (localStorage-persisted), training modules, FAQ, contact form, legal docs

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Shadcn/UI, @hello-pangea/dnd, ethers.js |
| Backend | Python 3.11, FastAPI, Motor (async MongoDB) |
| Database | MongoDB |
| Auth | Native Google OAuth 2.0 → JWT (7-day expiry) |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) via `anthropic` Python SDK |
| Email | Resend (primary, `noreply@tako.software`), Kit.com (optional subscriber lists) |
| Payments | Stripe + UNYT Token (Arbitrum) |
| Calling | Twilio Voice API |
| File parsing | pypdf (PDF, 30 pages), python-docx (DOCX) |
| Job scheduler | APScheduler 3.x with MongoDB jobstore |
| i18n | Custom `useT` hook with JSON locale files (English + German) |
| Deployment | Docker Compose (mongo + backend + frontend), nginx reverse proxy, Let's Encrypt SSL |

---

## Getting Started

### Prerequisites
- Python 3.11+, Node.js 20+, MongoDB, Docker (recommended)

### Docker (recommended)

```bash
git clone https://github.com/fbjk2000/tako-core.git
cd tako-core
cp backend/.env.example backend/.env   # fill in your values
docker compose up -d
```

App available at `http://localhost:3000` (frontend) and `http://localhost:8001` (backend API).

### Manual

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend
npm install --legacy-peer-deps
REACT_APP_BACKEND_URL=http://localhost:8001 npm start
```

---

## Environment Variables

**Backend** (`/backend/.env`):

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=tako_production

# Auth
JWT_SECRET=your_long_random_secret
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=168

# URLs
FRONTEND_URL=https://tako.software
PUBLIC_URL=https://tako.software

# Google OAuth (login + calendar)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI (platform key — used by internal team + new orgs during their AI trial)
ANTHROPIC_API_KEY=sk-ant-...
# Free AI trial duration (days) for new external orgs before they must add their own key
AI_TRIAL_DAYS=30

# Social Listening (Meta / Facebook Listeners)
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret

# Email
RESEND_API_KEY=re_...
SENDER_EMAIL=noreply@tako.software

# Payments
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Calling
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_FROM=+44...

# Admin
SUPER_ADMIN_EMAIL=admin@yourdomain.com
```

**Frontend** (`/frontend/.env`):

```env
REACT_APP_BACKEND_URL=https://tako.software
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add Authorised Redirect URIs:
   - `https://yourdomain.com/api/auth/google/login/callback` (login)
   - `https://yourdomain.com/api/calendar/google/callback` (calendar sync)
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your backend `.env`

---

## AI Setup

TAKO uses **Anthropic Claude** for all AI features.

- **Internal team**: Set `ANTHROPIC_API_KEY` in `.env`. Users whose email domain matches `fintery.com`, `tako.software`, `aios.dev`, `unyted.world`, `unyted.chat`, `openclaw.com`, or `floriankrueger.com` (plus explicit aliases) use the platform key automatically.
- **External organizations**: Every new org gets a **30-day free AI trial** on the platform key (orgs created before the trial feature are back-filled from `created_at`). When the trial ends, admins go to **Settings → Integrations → AI / LLM** and enter their own Anthropic API key. The Settings panel shows trial state live; the backend returns structured `ai_trial_expired` / `ai_key_missing` errors that the frontend surfaces as actionable toasts. Trial length defaults to 30 days and can be overridden with `AI_TRIAL_DAYS`.

---

## Social Listeners Setup

Listeners require a Meta app with **Page Public Content Access** permission (requires Meta app review — allow several weeks).

1. Create a Meta app at [developers.facebook.com](https://developers.facebook.com)
2. Add `META_APP_ID` and `META_APP_SECRET` to your backend `.env`
3. Run the Meta OAuth flow from **Settings → Integrations → Meta** to connect an account
4. Create a campaign with channel type `facebook`, then create a Listener on that campaign
5. *(Optional)* Pair the Chrome extension via **Listeners → Pair Extension** for passive browser-based ingestion

> **Note**: The Chrome extension is a separate repo (`tako-chrome-extension`). Device-code pairing is fully wired on the backend.

---

## Database Migrations

After deploying, run any pending migration scripts:

```bash
# Backfill channel_type on existing campaigns
python scripts/migrate_campaigns_add_channel.py
```

---

## API Reference

> **Base URL**: `https://yourdomain.com/api`

All endpoints require: `Authorization: Bearer <jwt_token>`

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List leads. Params: `status`, `source` |
| POST | `/api/leads` | Create lead |
| GET | `/api/leads/{lead_id}` | Get single lead |
| PUT | `/api/leads/{lead_id}` | Update lead |
| DELETE | `/api/leads/{lead_id}` | Delete lead |
| POST | `/api/leads/import-csv` | Import from CSV |
| POST | `/api/leads/{lead_id}/score` | AI score |
| POST | `/api/leads/{lead_id}/enrich` | AI enrich |
| POST | `/api/leads/{lead_id}/convert-to-contact` | Convert to contact |

### Contacts / Deals / Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/contacts` | List / create |
| GET/PUT/DELETE | `/api/contacts/{id}` | Read / update / delete |
| POST | `/api/contacts/import-csv` | Import from CSV |
| GET/POST | `/api/deals` | List / create |
| PUT | `/api/deals/{id}/stage` | Move stage |
| GET/POST | `/api/tasks` | List (`status`, `assigned_to`, `project_id`) / create |
| POST | `/api/tasks/{id}/comments` | Add comment |

### Listeners

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/listeners` | Create listener |
| GET | `/api/listeners` | List for org |
| PATCH | `/api/listeners/{id}` | Update / pause / resume |
| DELETE | `/api/listeners/{id}` | Delete |
| GET/POST | `/api/listeners/{id}/sources` | List / add sources |
| PATCH | `/api/listeners/{id}/sources/{src_id}` | Approve / reject source |
| GET | `/api/listeners/{id}/hits` | List hits |
| POST | `/api/listeners/{id}/hits/{hit_id}/create-task` | Create task from hit |
| GET | `/api/listeners/{id}/reports` | List reports |
| POST | `/api/listeners/{id}/reports/generate-now` | Generate report now |
| POST | `/api/listeners/{id}/discover` | Trigger group discovery |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload` | Upload. Params: `linked_type`, `linked_id`, `description` |
| GET | `/api/files` | List. Params: `linked_type`, `linked_id` |
| GET | `/api/files/{id}/download` | Download |
| DELETE | `/api/files/{id}` | Delete |
| POST | `/api/files/{id}/create-tasks` | Create tasks from AI suggestions |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/settings/integrations` | Org integration keys (admin/owner) |
| GET | `/api/settings/ai-status` | AI availability for current user |
| GET/PUT | `/api/settings/stages` | Custom deal/task stages |

---

## External API (v1)

**Base URL**: `https://yourdomain.com/api/v1`  
**Auth**: `X-API-Key: tako_<key>` (generate in Settings → API & Webhooks)

```http
POST /api/v1/leads
X-API-Key: tako_live_...

{ "first_name": "Jane", "last_name": "Smith", "email": "jane@startup.io", "source": "website" }
```

---

## Integrations

| Service | Purpose | Configure |
|---------|---------|-----------|
| **Google OAuth** | Login + Calendar sync | Google Cloud Console → Credentials |
| **Anthropic Claude** | All AI features | Platform key in `.env` or per-org in Settings → Integrations |
| **Meta (Facebook)** | Social Listeners | Meta Developer Portal → `META_APP_ID` + `META_APP_SECRET` in `.env` |
| **Resend** | Transactional email + campaigns | Settings → Integrations |
| **Twilio** | Outbound/inbound calling | Settings → Integrations |
| **Stripe** | Subscriptions + billing | Admin panel |
| **Kit.com** | Email marketing automation | Settings → Integrations (optional) |
| **Google Calendar** | Two-way calendar sync | Settings → Integrations → Connect |

---

## Deployment

TAKO runs as three Docker containers behind nginx with SSL:

```
nginx (SSL termination)
  ├── tako-frontend  (React app, port 3000)
  ├── tako-backend   (FastAPI, port 8001)
  └── tako-mongo     (MongoDB, port 27017 internal only)
```

```bash
git clone https://github.com/fbjk2000/tako-core.git /opt/tako
cd /opt/tako
cp backend/.env.example backend/.env
docker compose up -d
```

> **Important**: `docker compose restart` only bounces the container without recompiling. After a code change always run:
> ```bash
> docker compose build <service> && docker compose up -d <service>
> ```

nginx config:
```nginx
server {
    listen 443 ssl;
    server_name tako.software;
    location /api/ { proxy_pass http://127.0.0.1:8001/api/; }
    location / { proxy_pass http://127.0.0.1:3000/; }
}
```

---

## Recent Updates (Apr 2026 — Pre-launch QA)

Tracked under the 25-item ship-readiness audit. Highlights:

- **AI trial window** — 30-day platform-key grant on every new org, with back-fill for legacy orgs. Trial state surfaced in Settings → Integrations → AI; trial-expired and key-missing errors return structured payloads (`code`, `message`, `action`, `settings_url`, `support_url`) and render as actionable toasts with a one-click path to Settings.
- **Public booking page** — now renders host name, avatar, and welcome message from `GET /booking/{user_id}/info`.
- **Profile editing** — `PUT /auth/me` lets users update name, avatar, and timezone from Settings → Profile. IANA timezone picker uses `Intl.supportedValuesOf('timeZone')` with a fallback list and a "use my current timezone" one-click.
- **Password change** — `POST /auth/change-password` with bcrypt verification, 8-char minimum, plus a richer UI: strength meter, show/hide toggles, inline validation for mismatch / too-short / same-as-current, and post-save confirmation.
- **Calendar time picker** — date + time split with 5-minute steps, duration quick-picks (15m/30m/45m/1h/90m/2h), auto-preserved duration when start changes, and a live duration readout.
- **Landing page** — global `ScrollToTop` route listener disables browser scroll restoration and handles hash anchors; `#features`, `#pricing`, `#product` get `scroll-mt-20` so the fixed nav doesn't cover section headers.
- **Stripe row gating** — the Stripe integration row in Settings is visible only to internal/affiliated domains (`unyted.world`, `fintery.com`, `floriankrueger.com`, `davidaltun.com`, `alakai.digital`, `aios.institute`) plus two personal gmail addresses.
- **Admin View badge / Team Summary tab** — hidden for solo admins in Pipeline Reports.
- **Empty states** — Contacts, Leads, Listeners, and Files got richer empty states with explanatory copy and clear CTAs (plus gated upload/form UI).
- **Sidebar + nav** — Deals/Pipeline overlap resolved, sidebar overflow fixed, TAKO logo floating-dot artefact removed, duplicate Sign Out in Settings removed, Settings tabs no longer wrap, Kit.com tab hidden when unconnected.
- **Onboarding** — inline onboarding checklist on Dashboard with one-click copy-to-tasks into an "Onboarding" project.

---

## Pending / Roadmap

| Item | Status |
|------|--------|
| Chrome extension (`tako-chrome-extension`) | Not started — backend pairing ready |
| OAuth token encryption at rest | Not done — required before production Meta OAuth |
| Meta app review (Page Public Content Access) | Not submitted — start early, takes weeks |
| Instagram / LinkedIn Listeners | Backend channel stubs ready, poller not wired |
| Settings → Meta OAuth connect button (frontend) | Not done |
| Stripe / Twilio webhook consolidation into generic receiver | Not done |

---

## License

Proprietary — TAKO by Fintery Ltd. All rights reserved.

Canbury Works, Units 6 and 7, Canbury Business Park, Elm Crescent, Kingston upon Thames, Surrey, KT2 6HJ, UK
