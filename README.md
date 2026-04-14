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
- **Tasks** — Kanban drag-and-drop + list view, subtasks/checklists, comments, activity history, stale indicators, project linking
- **Projects** — Group tasks under deals, progress tracking, clickable task detail from project context, auto-created chat channels, team members
- **Companies** — Target company management with industry, size, and contact tracking
- **Calendar** — Month/Week views with scheduled calls, task due dates, deal closes, custom events with entity linking, Google Calendar sync
- **Campaigns** — Email campaigns via Resend + Kit.com, AI-powered drafting, bulk recipient management
- **Files** — File upload with AI summarisation (PDF, DOCX, text, images), linked to any entity

### AI Features (Claude)
- **Lead Scoring** — AI assigns a 1–100 quality score based on profile completeness and signals
- **Lead Enrichment** — Fills in company info, tech stack, interests, recommended sales approach
- **Email Drafting** — Personalised sales emails with tone/purpose selection
- **Lead Summary** — Comprehensive AI profile analysis
- **Smart Search** — Natural language search across all CRM data
- **Call Analysis** — AI feedback on recorded calls (score, strengths, improvements, next steps)
- **File Analysis** — Auto-summary and follow-up suggestions on uploaded documents
- **Access Control** — Internal team (Fintery, TAKO, AIOS, Unyted, OpenClaw, floriankrueger.com) use the platform key; external orgs supply their own Anthropic API key in Settings → Integrations

### Communication
- **Outbound Calling** — Twilio integration for direct calls from the CRM
- **Inbound Calls** — Auto-greeting, voicemail recording, caller identification
- **Call Scheduling** — Calendar-based scheduling with configurable reminders
- **Google Calendar** — OAuth integration, two-way sync, events displayed in calendar view
- **Team Chat** — Real-time messaging with channels: General, Lead, Deal, Project
- **Chat Archive** — Admins can archive channels, collapsible sidebar sections
- **Capture** — Live camera (getUserMedia) or file upload for business card scanning and lead creation

### Platform
- **Multi-tenant Organizations** — Roles: member, admin, owner, deputy_admin, support, super_admin
- **Per-org Integrations** — Each org manages their own API keys (Resend, Kit, Twilio, Google, Anthropic)
- **Auto Org Attribution** — Users with company emails auto-join matching organizations
- **License Management** — Super admin can override max user limits per organization
- **Team Invitations** — Invite via link, email, or CSV import
- **Multi-level Affiliate Program** — 3 tiers (Partner/Ambassador/Advocate), 20% customer discount, up to 60% commission chain
- **UNYT Token Payments** — Pay with UNYT on Arbitrum via MetaMask
- **Customizable Stages** — Admins can add/remove/rename deal stages and task statuses per org
- **PWA** — Installable on iOS, Android, and desktop
- **i18n** — English and German language support with toggle
- **API Keys and Webhooks** — Programmatic access for n8n, Notion, Zapier, and custom integrations
- **Data Explorer** — Super admin can browse all MongoDB collections
- **Reporting Engine** — User performance, pipeline forecasts, activity logs, CSV export
- **Subscription and Billing** — Stripe integration with discount codes and invoicing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Shadcn/UI, @hello-pangea/dnd, ethers.js |
| Backend | Python 3.11, FastAPI, Motor (async MongoDB) |
| Database | MongoDB |
| Auth | Native Google OAuth 2.0 → JWT (7-day expiry) |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) via `anthropic` Python SDK |
| Email | Resend (primary, `noreply@tako.software`), Kit.com (optional) |
| Payments | Stripe + UNYT Token (Arbitrum) |
| Calling | Twilio Voice API |
| File parsing | pypdf (PDF), python-docx (DOCX) |
| i18n | Custom `useT` hook with JSON locale files (English + German) |
| Deployment | Docker Compose (mongo + backend + frontend), nginx reverse proxy, Let's Encrypt SSL |

---

## Getting Started

### Prerequisites
- Python 3.11+, Node.js 18+, MongoDB, Docker (recommended)

### Docker (recommended)

```bash
git clone https://github.com/fbjk2000/tako-core.git
cd tako-core
cp backend/.env.example backend/.env   # fill in your values
docker compose up -d
```

App will be available at `http://localhost:3000` (frontend) and `http://localhost:8001` (backend API).

### Manual

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend
yarn install
REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
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

# Google OAuth (for login + calendar)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI (platform key — internal team only; external orgs add their own in Settings)
ANTHROPIC_API_KEY=sk-ant-...

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
- **External organizations**: Admins go to **Settings → Integrations → AI / LLM** and enter their own Anthropic API key. No platform key required.

---

## API Reference

> **Base URL**: `https://yourdomain.com/api`

All endpoints require: `Authorization: Bearer <jwt_token>`

### Authentication

#### Google Login
```http
GET /api/auth/google/login
```
Redirects to Google OAuth. On success, redirects browser to `FRONTEND_URL/auth/callback?token=<jwt>`.

#### Current User
```http
GET /api/auth/me
```
**Response**: `{ user_id, email, name, organization_id, role }`

---

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List leads. Params: `status`, `source` |
| POST | `/api/leads` | Create lead |
| GET | `/api/leads/{lead_id}` | Get single lead |
| PUT | `/api/leads/{lead_id}` | Update lead |
| DELETE | `/api/leads/{lead_id}` | Delete lead |
| POST | `/api/leads/import-csv` | Import from CSV (multipart/form-data) |
| POST | `/api/leads/{lead_id}/score` | AI score a lead |
| POST | `/api/leads/{lead_id}/enrich` | AI enrich a lead |
| POST | `/api/leads/{lead_id}/convert-to-contact` | Convert to contact |

#### Create Lead
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@acme.com",
  "phone": "+44123456789",
  "company": "Acme Corp",
  "job_title": "CEO",
  "source": "linkedin",
  "notes": "Met at SaaS Europe"
}
```

---

### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List contacts |
| POST | `/api/contacts` | Create contact |
| GET | `/api/contacts/{contact_id}` | Get single contact |
| PUT | `/api/contacts/{contact_id}` | Update contact |
| DELETE | `/api/contacts/{contact_id}` | Delete contact |
| POST | `/api/contacts/import-csv` | Import from CSV |

---

### Deals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deals` | List deals |
| POST | `/api/deals` | Create deal |
| PUT | `/api/deals/{deal_id}` | Update deal |
| DELETE | `/api/deals/{deal_id}` | Delete deal |
| PUT | `/api/deals/{deal_id}/stage` | Move stage |

---

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/{task_id}` | Update task |
| DELETE | `/api/tasks/{task_id}` | Delete task |
| POST | `/api/tasks/{task_id}/comments` | Add comment |

---

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload` | Upload file (multipart/form-data). Params: `linked_type`, `linked_id`, `description` |
| GET | `/api/files` | List files. Params: `linked_type`, `linked_id` |
| GET | `/api/files/{file_id}/download` | Download file |
| DELETE | `/api/files/{file_id}` | Delete file |
| POST | `/api/files/{file_id}/create-tasks` | Create tasks from AI follow-up suggestions |

Supported types for AI analysis: **PDF** (up to 30 pages), **DOCX**, **plain text / CSV / JSON**, **images**.

---

### Settings / Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/integrations` | Get org integration keys (admin/owner only) |
| PUT | `/api/settings/integrations` | Update org integration keys |
| GET | `/api/settings/ai-status` | Check if AI is available for current user |
| GET | `/api/settings/stages` | Get custom deal/task stages |
| PUT | `/api/settings/stages` | Update stages |

#### Supported integration keys
```json
{
  "resend_api_key": "re_...",
  "resend_sender_email": "noreply@yourdomain.com",
  "kit_api_key": "...",
  "kit_api_secret": "...",
  "twilio_sid": "AC...",
  "twilio_token": "...",
  "twilio_phone": "+44...",
  "google_client_id": "...",
  "google_client_secret": "...",
  "anthropic_api_key": "sk-ant-..."
}
```

---

## External API (v1)

For programmatic access from n8n, Zapier, Notion, or custom tools.

**Base URL**: `https://yourdomain.com/api/v1`  
**Auth**: `X-API-Key: <your_api_key>` (generate in Settings → API & Webhooks)

```http
POST /api/v1/leads
X-API-Key: tako_live_...

{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@startup.io",
  "source": "website"
}
```

---

## Integrations

| Service | Purpose | Configure |
|---------|---------|-----------|
| **Google OAuth** | Login + Calendar sync | Google Cloud Console → Credentials |
| **Anthropic Claude** | All AI features | Platform key in `.env` or per-org in Settings → Integrations |
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

### VPS deployment

```bash
git clone https://github.com/fbjk2000/tako-core.git /opt/tako
cd /opt/tako
cp backend/.env.example backend/.env
# edit backend/.env with production values
docker compose up -d
```

nginx config example:
```nginx
server {
    listen 443 ssl;
    server_name tako.software;

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
    }
    location / {
        proxy_pass http://127.0.0.1:3000/;
    }
}
```

---

## License

Proprietary — TAKO by Fintery Ltd. All rights reserved.

Canbury Works, Units 6 and 7, Canbury Business Park, Elm Crescent, Kingston upon Thames, Surrey, KT2 6HJ, UK
