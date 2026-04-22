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
  <a href="#security">Security</a> •
  <a href="#operations">Operations</a> •
  <a href="#pricing">Pricing</a> •
  <a href="#distribution">Distribution</a> •
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
- **Included AI** — Licensed TAKO instances ship with unlimited access to Claude via the platform key. Bring-your-own Anthropic key is also supported per organization (Settings → Integrations).

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
- **Organizations** — Roles: member, admin, owner. Self-hosted single-tenant or multi-tenant deployment
- **Per-org Integrations** — Each org manages their own API keys (Resend, Kit, Twilio, Google, Anthropic, Meta)
- **Customizable Stages** — Admins can add/remove/rename deal stages and task steps per org
- **Team Invitations** — Invite via link, email, or CSV import — unlimited users on every licence
- **Partner Programme** — Referral partners earn €500 per sale. Agency partners earn an additional €750 onboarding commission per customer. Two-tier, no MLM chains
- **Self-serve Demo** — Prospects get a fully seeded 14-day trial org in minutes at `/demo` (pre-populated leads, deals, tasks, calendar). On expiry the tenant soft-locks: reads stay open, writes are blocked middleware-wide until the user upgrades. Super admins can extend, expire, or purge demos from the admin panel.
- **Distribution System** — `scripts/build-distribution.sh` produces a self-contained customer tarball (source + Docker + customer `.env.example` + install guide + backup script). Platform-only code — UNYT/crypto, self-serve demo, partner payouts, super-admin UI, distribution tooling — is stripped via sentinel-wrapped regions (`DEMO_BEGIN`/`PLATFORM_BEGIN` markers) so customers never see it.
- **Release Pipeline** — Tagging `vX.Y.Z` on `main` runs `.github/workflows/release.yml`, which builds the distribution tarball, generates SHA-256 checksums, creates a GitHub Release, and posts a notification to `/api/admin/releases/notify` so the changelog and in-app update checker update automatically.
- **In-app Update Checker** — Customer instances call `/api/system/update-check` once per day against the platform; if a newer version is tagged, a banner appears in the admin UI linking to the changelog and download page. Results are cached per-org for 24h to stay polite.
- **GDPR Compliance** — Self-service data export (`/api/gdpr/export-my-data`), account deletion with grace period (`/api/gdpr/request-deletion` / `/api/gdpr/cancel-deletion`), and a public DPA endpoint at `/api/legal/dpa`.
- **UNYT Token Payments** — Pay with UNYT on Arbitrum via MetaMask or via [UNYT.shop](https://unyt.shop)
- **License & Billing** — One-time purchase or installment plans via Stripe. UNYT token payments via MetaMask or UNYT.shop. Optional annual maintenance renewal
- **PWA** — Installable on iOS, Android, and desktop
- **i18n** — English and German language support with toggle
- **API Keys and Webhooks** — Programmatic access for n8n, Notion, Zapier, and custom integrations
- **Reporting Engine** — User performance, pipeline forecasts, activity logs, CSV export
- **Onboarding & Support** — In-app onboarding checklist (localStorage-persisted), training modules, FAQ, in-app support ticket form, legal docs

---

## Security

TAKO ships with a defense-in-depth posture suitable for production use by European teams handling customer data. Key controls:

- **Email verification** — New accounts must verify via a tokenized link before they can log in; unverified accounts are blocked at login.
- **Dual-token JWT** — Access tokens expire in 15 minutes (`JWT_ACCESS_EXPIRY_MINUTES`), refresh tokens last 7 days (`JWT_REFRESH_EXPIRY_DAYS`). Refresh is rotated on use; the legacy single-token flow (`JWT_EXPIRY_HOURS`) is still honoured for in-flight sessions during upgrade.
- **Login rate limiting** — Password and 2FA endpoints throttle per-IP to blunt credential stuffing.
- **Password reset** — Tokens are single-use with a 1-hour TTL; reset emails never leak whether an account exists.
- **Stripe webhook hardening** — `/api/webhook/stripe` verifies the `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET` and de-duplicates events by `event.id` so retries are safe.
- **Invoice XSS hardening** — HTML invoices escape every user-controlled field before rendering; no template injection surface.
- **Session termination on org deletion** — When an organization is deleted, all associated sessions are revoked and users are force-logged-out on next request.
- **VAT-aware invoicing** — `COMPANY_VAT_NUMBER` is emitted on every invoice; missing VAT keeps the obvious placeholder `GB000000000` so no invoice silently ships without one.
- **Tenant isolation** — All CRM queries scope to the caller's `organization_id`; cross-tenant access is not possible via the REST or v1 external API.

See [`docs/VPS-HARDENING.md`](docs/VPS-HARDENING.md) for the host-level companion guide (unprivileged deploy user, SSH key-only auth, UFW, fail2ban, automatic security updates, MongoDB bind-address).

---

## Operations

- **Health check** — `GET /api/health` returns a JSON status payload covering MongoDB reachability, email sender readiness, Sentry init, and Stripe webhook configuration. It returns **200** when MongoDB is reachable and **503** when it is not — use it as the target for an external uptime monitor.
- **Error monitoring** — Set `SENTRY_DSN` (backend `.env`) and `REACT_APP_SENTRY_DSN` (frontend build env) to enable Sentry. Both are optional soft dependencies — the backend and frontend start without error if the SDK isn't installed or the DSN isn't set. `ENVIRONMENT` / `REACT_APP_ENVIRONMENT` tag events so staging and prod don't pollute each other.
- **Backups** — `scripts/backup-mongo.sh` dumps the MongoDB database, tars the output, and retains the last 7 days in `$BACKUP_DIR` (default `/opt/tako/backups`). Designed to run daily from cron. Restore is `tar -xzf tako_YYYYMMDD_HHMMSS.tar.gz` followed by `mongorestore --uri=... --db=tako tako_YYYYMMDD_HHMMSS/tako`. The script has a TODO for the offsite S3 upload — until that's wired up, rely on the VPS provider's disk snapshots as the second copy.
- **Support tickets** — Users submit issues from any page via `POST /api/support/ticket`; tickets land in the super-admin panel with user, org, and environment metadata auto-attached. Public (unauthenticated) contact enquiries go through `POST /api/support/contact`.
- **Host hardening** — [`docs/VPS-HARDENING.md`](docs/VPS-HARDENING.md) walks through IONOS/VPS first-boot steps: unprivileged deploy user, SSH key-only auth, UFW, fail2ban, unattended-upgrades, MongoDB bound to localhost.

---

## Pricing

TAKO is a self-hosted CRM. Purchase once, deploy on your own infrastructure, own your data forever.

| Option | Price | Notes |
|--------|-------|-------|
| **One-time** | €5,000 | Single payment, perpetual licence |
| **12-month installment** | €500 / month × 12 | €6,000 total, perpetual licence after final payment |
| **24-month installment** | €300 / month × 24 | €7,200 total, perpetual licence after final payment |
| **UNYT Token** | Pay in UNYT on Arbitrum | Perpetual licence, any plan (see [UNYT.shop](https://unyt.shop)) |

**All licences include:**
- Unlimited users
- All CRM features (Leads, Contacts, Deals, Tasks, Projects, Campaigns, Listeners, Files, Calendar, Chat, Calls)
- Unlimited AI via Claude (platform key included)
- All integrations (Google, Resend, Kit, Twilio, Meta, Stripe)
- API access + webhooks
- First year of updates and maintenance

**Maintenance renewal** — €999 per year (optional). Renewing keeps you on the latest version with priority support. If you skip renewal your instance keeps running — you simply stop receiving updates.

**Partner Programme** — Agencies and consultants earn €500 per customer sale, plus €750 per agency onboarding. Apply at `/partners` on your TAKO instance.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Shadcn/UI, @hello-pangea/dnd, ethers.js |
| Backend | Python 3.11, FastAPI, Motor (async MongoDB) |
| Database | MongoDB |
| Auth | Native Google OAuth 2.0 → dual-token JWT (15-min access / 7-day refresh; legacy 7-day single-token still honoured) |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) via `anthropic` Python SDK |
| Email | Resend (primary, `noreply@tako.software`), Kit.com (optional subscriber lists) |
| Payments | Stripe + UNYT Token (Arbitrum) |
| Calling | Twilio Voice API |
| File parsing | pypdf (PDF, 30 pages), python-docx (DOCX) |
| Job scheduler | APScheduler 3.x with MongoDB jobstore (demo expiry, listener polling, digests, rescoring) |
| Error monitoring | Sentry (backend + frontend, both soft dependencies) |
| i18n | Custom `useT` hook with JSON locale files (English + German) |
| Deployment | Docker Compose (mongo + backend + frontend), nginx reverse proxy, Let's Encrypt SSL |
| Release | GitHub Actions (`.github/workflows/release.yml`) + `scripts/build-distribution.sh` |

---

## Distribution

TAKO is distributed to customers as a stripped source tarball — they run the same code we do, minus the platform-only plumbing.

### Build script

`scripts/build-distribution.sh` produces `dist/tako-crm-<version>.tar.gz` plus an accompanying `.sha256` and `VERSION` file. What it ships:

- Full backend and frontend source, minus stripped regions
- `docker-compose.yml` and Dockerfiles
- Customer-facing `backend/.env.example` (no platform keys, no Stripe price IDs, no `DISTRIBUTION_DIR`)
- `scripts/backup-mongo.sh`
- `scripts/distribution-README.md` (install guide)
- `docs/VPS-HARDENING.md`

What it strips:

- **UNYT / crypto payment UI and routes** — customers see Stripe only
- **Self-serve demo** — `/demo` endpoints, demo seeder, middleware soft-lock, admin demo management
- **Platform-only pages** — `/changelog`, `/download`, partner onboarding admin UI
- **Super-admin surfaces** — analytics, data explorer, release notify endpoint, partner payout admin
- **Distribution tooling itself** — `scripts/build-distribution.sh`, release workflow, `DISTRIBUTION_DIR` handling
- **Internal configs** — `.emergent/`, platform-only migrations, internal test fixtures

Stripping is driven by sentinel-wrapped regions using the generalized markers `DEMO_BEGIN`/`DEMO_END` and `PLATFORM_BEGIN`/`PLATFORM_END` (matched as `(?P<kind>DEMO|PLATFORM)_BEGIN` … `(?P=kind)_END`). Touch them carefully — the regex is paired.

### Release workflow

1. Bump the version in `backend/server.py` (`TAKO_VERSION`) and commit.
2. `git tag vX.Y.Z && git push --tags`.
3. `.github/workflows/release.yml` runs: builds the tarball, computes SHA-256, creates the GitHub Release with both artifacts attached, and POSTs to `/api/admin/releases/notify` (super-admin key) so `/api/releases` and `/changelog` pick it up immediately.
4. Customer instances hit `/api/system/update-check` on their next daily tick, see the new version, and surface a banner linking to `/download` with a fresh signed token from `POST /api/license/download`.

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

**Backend** (`/backend/.env`) — see [`backend/.env.example`](backend/.env.example) for the full template.

**Required** (TAKO will not start without these):

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=tako_production

# Auth — dual-token JWT
JWT_SECRET=your_long_random_secret
JWT_ALGORITHM=HS256
JWT_ACCESS_EXPIRY_MINUTES=15
JWT_REFRESH_EXPIRY_DAYS=7
JWT_EXPIRY_HOURS=168          # legacy single-token flow; still honoured

# URLs
FRONTEND_URL=https://yourdomain.com
PUBLIC_URL=https://yourdomain.com

# Google OAuth (login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI (platform key — all licensed orgs use this automatically)
ANTHROPIC_API_KEY=sk-ant-...

# Invoicing
COMPANY_VAT_NUMBER=GB123456789
```

**Optional** — set only the integrations you actually use:

```env
# Email (transactional + campaigns)
RESEND_API_KEY=re_...
SENDER_EMAIL=noreply@yourdomain.com
KIT_API_KEY=
KIT_API_SECRET=

# Calling
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_FROM=+44...

# Social Listening (Facebook / Instagram)
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret

# Payments (only needed if you resell TAKO or accept Stripe payments)
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ONETIME=price_...
STRIPE_PRICE_12MO=price_...
STRIPE_PRICE_24MO=price_...
STRIPE_PRICE_MAINTENANCE=price_...

# Error monitoring (soft dependency — safe to leave blank)
SENTRY_DSN=
ENVIRONMENT=production

# Distribution output dir (platform-only — stripped from customer builds)
DISTRIBUTION_DIR=./dist
```

**Frontend** (`/frontend/.env`):

```env
REACT_APP_BACKEND_URL=https://tako.software
REACT_APP_SENTRY_DSN=               # optional
REACT_APP_ENVIRONMENT=production    # optional
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

Set `ANTHROPIC_API_KEY` in your `.env` file. All AI features are included in your TAKO licence — no token limits, no trial periods. Every licensed organization uses the platform key automatically.

Admins can optionally switch an organization to its own Anthropic key in **Settings → Integrations → AI / LLM**.

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

All endpoints require: `Authorization: Bearer <jwt_token>` unless otherwise noted.

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

### GDPR

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gdpr/export-my-data` | Generate full data export for the calling user (JSON archive) |
| POST | `/api/gdpr/request-deletion` | Schedule account + associated data deletion (grace period) |
| POST | `/api/gdpr/cancel-deletion` | Cancel a pending deletion during the grace window |
| GET | `/api/legal/dpa` | Public Data Processing Agreement (no auth) |

### Support

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/support/contact` | Public contact form (no auth) — routes to super admin inbox |
| POST | `/api/support/ticket` | Authenticated in-app support ticket with user/org/env auto-attached |

### License & Updates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/license/renew-maintenance` | Start Stripe checkout for the €999 annual maintenance SKU |
| POST | `/api/license/download` | Issue a short-lived signed token for downloading the current release |
| GET | `/api/license/download/{token}` | Redeem the signed token; streams the tarball from `DISTRIBUTION_DIR` |
| GET | `/api/version/latest` | Latest tagged version (public, no auth) |
| GET | `/api/version/check` | Per-caller version comparison (`current` vs `latest`, `update_available` flag) |
| GET | `/api/releases` | Last 20 releases, newest first (public — powers `/changelog`) |
| POST | `/api/admin/releases/notify` | Platform-only. Called by the release workflow after a tag is published |
| GET | `/api/system/update-check` | Customer instance → platform daily check; 24h per-org cache |

### Demo (platform-only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/demo/create` | Spin up a seeded 14-day demo org from the landing page |
| GET | `/api/admin/demos` | Super admin — list all active / expired demo orgs |
| POST | `/api/admin/demos/{org_id}/extend` | Extend a demo by N days |
| POST | `/api/admin/demos/{org_id}/expire` | Force-expire a demo (soft lock activates immediately) |
| DELETE | `/api/admin/demos/{org_id}` | Purge a demo org and all associated data |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | 200 when MongoDB is reachable, 503 otherwise. JSON body: Mongo, email, Sentry, Stripe status. |

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
| **Stripe** | Licence purchase + installment billing | Admin panel (optional — only needed if you resell TAKO) |
| **Kit.com** | Email marketing automation | Settings → Integrations (optional) |
| **Google Calendar** | Two-way calendar sync | Settings → Integrations → Connect |
| **Sentry** | Backend + frontend error monitoring (soft dep) | `SENTRY_DSN` / `REACT_APP_SENTRY_DSN` |

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

For host hardening, backups, health checks, and error monitoring details, see [Security](#security) and [Operations](#operations) above. For VPS-level steps (deploy user, SSH, UFW, fail2ban, MongoDB bind), see [`docs/VPS-HARDENING.md`](docs/VPS-HARDENING.md).

---

## Recent Updates (Apr 2026)

- **Security audit & hardening** — Dual-token JWT flow (15-min access / 7-day refresh) with rotation on refresh, per-IP login rate limiting, single-use 1-hour password-reset tokens, Stripe webhook signature verification with event-id idempotency, HTML escaping on invoices, session termination on org deletion, VAT-aware invoicing (`COMPANY_VAT_NUMBER`). Host-level guide added at `docs/VPS-HARDENING.md`.
- **Operations telemetry** — `GET /api/health` covers Mongo, email, Sentry, and Stripe readiness (200/503). Sentry SDK wired as a soft dependency on both backend and frontend. `scripts/backup-mongo.sh` with 7-day retention runs from cron.
- **In-app support tickets** — `POST /api/support/ticket` surfaces user-submitted issues with env/org/user metadata pre-filled in the super-admin inbox.
- **GDPR endpoints** — Self-service data export, account deletion with grace period, and a public DPA endpoint at `/api/legal/dpa`.
- **Distribution system** — `scripts/build-distribution.sh` produces a clean customer tarball with platform-only code stripped via `DEMO_BEGIN`/`PLATFORM_BEGIN` sentinel regions. Output lands in `DISTRIBUTION_DIR` (`./dist` by default).
- **Self-serve demo** — Landing-page `/demo` spins up a seeded 14-day trial org. APScheduler runs daily expiry; expired tenants soft-lock via middleware (writes blocked, reads open). Super admins extend/expire/purge from the admin panel.
- **Release pipeline** — `.github/workflows/release.yml` builds the tarball, attaches SHA-256, creates the GitHub Release, and calls `/api/admin/releases/notify` so `/changelog` and the update banner pick up new versions automatically.
- **Customer update checker** — `/api/system/update-check` runs once per day from each customer instance with a 24h per-org cache; admins see a banner linking to `/changelog` and a fresh signed download token from `POST /api/license/download` when a newer version ships.

### Apr 2026 — Pre-launch QA highlights

- **Self-hosted licence model** — one-time, 12-month, and 24-month installment plans via Stripe; UNYT token payments on Arbitrum; optional €999/year maintenance renewal. All licences unlock unlimited users and unlimited AI.
- **Public booking page** — now renders host name, avatar, and welcome message from `GET /booking/{user_id}/info`.
- **Profile editing** — `PUT /auth/me` lets users update name, avatar, and timezone from Settings → Profile. IANA timezone picker uses `Intl.supportedValuesOf('timeZone')` with a fallback list and a "use my current timezone" one-click.
- **Password change** — `POST /auth/change-password` with bcrypt verification, 8-char minimum, plus a richer UI: strength meter, show/hide toggles, inline validation for mismatch / too-short / same-as-current, and post-save confirmation.
- **Calendar time picker** — date + time split with 5-minute steps, duration quick-picks (15m/30m/45m/1h/90m/2h), auto-preserved duration when start changes, and a live duration readout.
- **Landing page** — global `ScrollToTop` route listener disables browser scroll restoration and handles hash anchors; `#features`, `#pricing`, `#product` get `scroll-mt-20` so the fixed nav doesn't cover section headers.
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
| Offsite backup upload (S3) in `scripts/backup-mongo.sh` | TODO in script — rely on VPS snapshots until wired |
| DPA legal text for `/api/legal/dpa` | Awaiting counsel review |

---

## License

Proprietary — TAKO by Fintery Ltd. All rights reserved.

Purchasers receive a perpetual licence to use, modify, and deploy TAKO on their own infrastructure. Redistribution or resale of the source code is not permitted.

Canbury Works, Units 6 and 7, Canbury Business Park, Elm Crescent, Kingston upon Thames, Surrey, KT2 6HJ, UK
