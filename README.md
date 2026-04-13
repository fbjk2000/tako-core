# earnrm — Your CRM that pAIs you back

<p align="center">
  <img src="https://customer-assets.emergentagent.com/job_leadhub-app-2/artifacts/u9efkh3m_earnrm_logo_horizontal_light_notag_purpleword.png" alt="earnrm" height="60" />
</p>

<p align="center">
  <strong>AI-powered CRM for lead management, deal pipeline, projects, team collaboration & outbound calling</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#external-api-v1">External API</a> •
  <a href="#integrations">Integrations</a>
</p>

---

## Features

### Core CRM
- **Leads** — Import via CSV, manual creation, AI enrichment & scoring, bulk operations, column visibility, business card capture
- **Contacts** — Convert from qualified leads, rich profiles (budget, timeline, decision maker, pain points)
- **Deals** — Kanban pipeline with drag-and-drop + list view, entity linking (Lead/Contact/Company), lost deals excluded from pipeline
- **Tasks** - Kanban drag-and-drop + list view, subtasks/checklists, comments, activity history, stale indicators, project linking
- **Projects** - Group tasks under deals, progress tracking, clickable task detail from project context, auto-created chat channels, team members
- **Companies** — Target company management with industry, size, and contact tracking
- **Calendar** — Month/Week views with scheduled calls, task due dates, deal closes, custom events with entity linking, Google Calendar sync
- **Campaigns** — Email campaigns via Resend + Kit.com, AI-powered drafting, bulk recipient management

### AI Features (GPT-5.2)
- **Lead Scoring** — AI assigns a 1-100 quality score
- **Lead Enrichment** — Fills in company info, tech stack, interests, recommended sales approach
- **Email Drafting** — Personalized sales emails with tone/purpose selection
- **Lead Summary** — Comprehensive AI profile analysis
- **Smart Search** — Natural language search across all CRM data
- **Call Analysis** — AI feedback on recorded calls (score, strengths, improvements, next steps)

### Communication
- **Outbound Calling** — Twilio integration for direct calls from the CRM
- **Inbound Calls** — Auto-greeting, voicemail recording, caller identification
- **Call Scheduling** — Calendar-based scheduling with configurable reminders
- **Google Calendar** — OAuth integration, two-way sync, events displayed in calendar view
- **Team Chat** — Real-time messaging with channels: General, Lead, Deal, Project
- **Chat Archive** — Admins can archive channels, collapsible sidebar sections

### Platform
- **Multi-tenant Organizations** - Roles: member, admin, owner, deputy_admin, support, super_admin
- **Per-org Integrations** - Each org manages their own API keys (Resend, Kit, Twilio, Google)
- **Auto Org Attribution** - Users with company emails auto-join matching organizations
- **License Management** - Super admin can override max user limits per organization
- **Team Invitations** - Invite via link, email, or CSV import
- **Multi-level Affiliate Program** - 3 tiers (Partner/Ambassador/Advocate), 20% customer discount, up to 60% commission chain
- **UNYT Token Payments** - Pay with UNYT on Arbitrum via MetaMask
- **Customizable Stages** - Admins can add/remove/rename deal stages and task statuses per org
- **PWA** - Installable on iOS, Android, and desktop
- **i18n** - English and German language support with toggle
- **API Keys and Webhooks** - Programmatic access for n8n, Notion, Zapier, and custom integrations
- **Data Explorer** - Super admin can browse all MongoDB collections
- **Reporting Engine** - User performance, pipeline forecasts, activity logs, CSV export
- **Subscription and Billing** - Stripe integration with discount codes (editable) and invoicing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Shadcn/UI, @hello-pangea/dnd, ethers.js |
| Backend | Python 3.11, FastAPI, Motor (async MongoDB) |
| Database | MongoDB |
| Auth | JWT (7-day expiry) + Emergent Google OAuth |
| AI | OpenAI GPT-5.2 via Emergent Integrations |
| Email | Resend (primary), Kit.com (optional) |
| Payments | Stripe + UNYT Token (Arbitrum) |
| Calling | Twilio Voice API |
| i18n | react-i18next (English + German) |

---

## Getting Started

### Prerequisites
- Python 3.11+, Node.js 18+, MongoDB, Yarn

### Environment Variables

**Backend** (`/backend/.env`):
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="earnrm_db"
JWT_SECRET="your_secret_key"
JWT_ALGORITHM="HS256"
JWT_EXPIRY_HOURS=168
EMERGENT_LLM_KEY="your_emergent_key"
RESEND_API_KEY="your_resend_key"
SENDER_EMAIL="noreply@earnrm.com"
KIT_API_KEY="your_kit_key"
KIT_API_SECRET=""
STRIPE_API_KEY="your_stripe_key"
SUPER_ADMIN_EMAIL="admin@yourdomain.com"
FRONTEND_URL="https://yourdomain.com"
TWILIO_ACCOUNT_SID="your_twilio_sid"
TWILIO_AUTH_TOKEN="your_twilio_token"
TWILIO_PHONE_FROM="+1234567890"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
PUBLIC_URL="https://earnrm.com"
```

**Frontend** (`/frontend/.env`):
```env
REACT_APP_BACKEND_URL=https://yourdomain.com
```

### Installation

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend
yarn install
yarn start
```

---

## API Reference

> **Base URL**: `https://yourdomain.com/api`

### Authentication

All internal endpoints require: `Authorization: Bearer <jwt_token>`

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "password" }
```
**Response**: `{ "user_id", "email", "name", "organization_id", "role", "token" }`

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "name": "John Doe",
  "organization_name": "Acme Corp",  // optional - creates org
  "invite_code": "abc123"             // optional - joins existing org
}
```

#### Google OAuth Session
```http
POST /api/auth/session
Content-Type: application/json

{ "session_id": "<session_id_from_oauth_redirect>" }
```

#### Current User
```http
GET /api/auth/me
```

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
| POST | `/api/leads/{lead_id}/convert-to-contact` | Convert to contact. Param: `deal_id` |

#### Create Lead
```json
{
  "first_name": "John",       // required
  "last_name": "Doe",         // required
  "email": "john@acme.com",
  "phone": "+44123456789",
  "company": "Acme Corp",
  "job_title": "CTO",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "source": "manual"          // manual, csv_import, signup, affiliate:{code}, google_signup
}
```

**CSV columns**: `first_name, last_name, email, phone, company, job_title, linkedin_url, source`

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

#### Create Contact
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@corp.com",
  "phone": "+44987654321",
  "company": "Corp Inc",
  "job_title": "VP Sales",
  "linkedin_url": "https://linkedin.com/in/janesmith",
  "website": "https://corp.com",
  "location": "London, UK",
  "industry": "Technology",
  "company_size": "51-200",
  "decision_maker": true,
  "budget": "€50,000",
  "timeline": "Q2 2026",
  "pain_points": "Manual lead tracking, no pipeline visibility",
  "preferred_contact_method": "email",
  "lead_id": "lead_xxx",      // if converted from lead
  "deal_id": "deal_xxx"       // linked deal
}
```

---

### Deals

Kanban pipeline with drag-and-drop between stages, plus a list view toggle. Click any deal card or row to open the detail/edit dialog. Lost deals excluded from pipeline totals.

**Views:** Kanban (drag-and-drop) | List (table with inline stage dropdown)

**Deal detail dialog:**
- View: value, stage, probability, close date, tags, notes, linked entities
- Edit: all fields including Lead/Contact/Company association
- Actions: Discuss, Delete

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deals` | List deals. Params: `stage`, `tag`, `assigned_to` |
| POST | `/api/deals` | Create deal |
| PUT | `/api/deals/{deal_id}` | Update deal (name, value, stage, probability, lead_id, contact_id, company_id, notes, tags) |
| DELETE | `/api/deals/{deal_id}` | Delete deal |
| GET | `/api/deals/tags` | List all tags |

#### Create Deal
```json
{
  "name": "Enterprise License",
  "value": 50000,
  "currency": "EUR",
  "stage": "qualified",          // lead, qualified, proposal, negotiation, won, lost
  "probability": 60,             // 0-100
  "lead_id": "lead_xxx",        // optional link
  "contact_id": "contact_xxx",  // optional link
  "company_id": "company_xxx",  // optional link
  "expected_close_date": "2026-06-30T00:00:00Z",
  "tags": ["enterprise", "q2"],
  "notes": "Decision expected by end of month",
  "task_title": "Follow up call",        // creates initial task (required)
  "task_owner_id": "user_xxx",           // required
  "task_description": "Discuss pricing",
  "task_due_date": "2026-04-01T00:00:00Z"
}
```

> **Note**: Lost deals are excluded from pipeline value calculations.

---

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects (includes task_count, progress) |
| POST | `/api/projects` | Create project (auto-creates chat channel) |
| GET | `/api/projects/{project_id}` | Get project with tasks, deal, members |
| PUT | `/api/projects/{project_id}` | Update project |
| DELETE | `/api/projects/{project_id}` | Delete project (archives chat) |

#### Create Project
```json
{
  "name": "Q2 Enterprise Onboarding",
  "description": "Onboard Acme Corp to enterprise plan",
  "status": "active",           // active, on_hold, completed
  "deal_id": "deal_xxx",       // optional linked deal
  "members": ["user_xxx"]      // team member user_ids
}
```

**Response includes**: `project_id`, auto-created chat channel `proj_chat_{project_id}`

> Tasks linked to a project use `project_id` field in the task payload.

---

### Tasks

Kanban board with drag-and-drop between columns (To Do, In Progress, Done). Click any task card to view full details or edit.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks. Params: `status`, `assigned_to` |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/{task_id}` | Update task (title, description, status, priority, due_date, assigned_to) |
| DELETE | `/api/tasks/{task_id}` | Delete task |

#### Create Task
```json
{
  "title": "Follow up with client",
  "description": "Discuss pricing options",
  "status": "todo",                // todo, in_progress, done
  "priority": "high",              // low, medium, high
  "due_date": "2026-04-01T10:00:00Z",
  "assigned_to": "user_xxx",
  "related_lead_id": "lead_xxx",
  "related_deal_id": "deal_xxx",
  "project_id": "proj_xxx"        // links task to project
}
```

---

### Companies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies` | List companies |
| POST | `/api/companies` | Create company |
| GET | `/api/companies/{company_id}` | Get single company |

#### Create Company
```json
{
  "name": "Acme Corp",
  "industry": "Technology",
  "website": "https://acme.com",
  "size": "51-200",
  "description": "Enterprise SaaS company"
}
```

---

### AI Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/score-lead/{lead_id}` | AI score (1-100) |
| POST | `/api/ai/enrich-lead/{lead_id}` | AI enrichment (company, tech, interests) |
| POST | `/api/ai/draft-email` | AI email drafting |
| POST | `/api/ai/lead-summary/{lead_id}` | AI lead summary |
| GET | `/api/ai/search` | Smart search. Param: `q` |

#### Draft Email
```http
POST /api/ai/draft-email?lead_id=xxx&purpose=introduction&tone=professional
```
**Purposes**: `introduction`, `follow_up`, `proposal`, `check_in`, `meeting_request`, `thank_you`
**Tones**: `professional`, `friendly`, `casual`, `formal`
**Response**: `{ "subject", "content", "lead_name", "company_name", "purpose", "tone" }`

#### Enrich Lead Response
```json
{
  "lead_id": "lead_xxx",
  "enrichment": {
    "company_description": "...",
    "industry": "Technology",
    "company_size": "51-200",
    "website": "https://...",
    "technologies": ["React", "AWS", "PostgreSQL"],
    "interests": ["Sales automation", "AI"],
    "recommended_approach": "Lead with ROI data..."
  },
  "lead": { /* updated lead object */ }
}
```

---

### Calls

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/calls/initiate` | Make outbound call |
| GET | `/api/calls` | List calls. Param: `lead_id` |
| GET | `/api/calls/{call_id}` | Get call detail |
| POST | `/api/calls/{call_id}/analyze` | AI analysis |
| GET | `/api/calls/stats/overview` | Call statistics |
| POST | `/api/calls/schedule` | Schedule a call |
| GET | `/api/calls/scheduled` | List scheduled calls |
| GET | `/api/calls/scheduled/upcoming` | Next 7 days |
| PUT | `/api/calls/scheduled/{id}` | Update scheduled call |
| DELETE | `/api/calls/scheduled/{id}` | Cancel scheduled call |
| POST | `/api/calls/scheduled/check-reminders` | Trigger reminders |

#### Initiate Call
```json
{ "lead_id": "lead_xxx", "message": "Thanks for your interest" }
```

#### Schedule Call
```json
{
  "lead_id": "lead_xxx",
  "scheduled_at": "2026-04-01T14:00:00Z",
  "notes": "Discuss enterprise pricing",
  "reminder_minutes": 15       // 5, 15, 30, 60, 1440
}
```

#### Twilio Webhooks
| Endpoint | Purpose |
|----------|---------|
| `POST /api/webhooks/twilio/inbound` | Handle incoming calls |
| `POST /api/webhooks/twilio/call-status` | Call status updates |
| `POST /api/webhooks/twilio/recording-status` | Recording ready |

---

### Calendar

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendar/events` | All events (calls, tasks, deals, custom, Google) |
| POST | `/api/calendar/events` | Create event. Params: `title`, `date`, `end_date`, `notes`, `color`, `linked_type`, `linked_id`, `location`, `invitee_emails`, `blocks_booking` |
| PUT | `/api/calendar/events/{event_id}` | Edit event (title, date, end_date, notes, color, linked_type, linked_id) |
| DELETE | `/api/calendar/events/{event_id}` | Delete event |
| POST | `/api/calendar/events/{event_id}/invite` | Invite people. Body: `["email@example.com"]` |
| GET | `/api/calendar/team-events` | Get all team members' events for overlay view |

#### Event features
- **Start and end time**: Every event has a start (`date`) and end (`end_date`) displayed as duration blocks
- **Week view with time grid**: Hours from 7am to 9pm, events shown as colored blocks with duration
- **Team overlay**: Toggle "Team" switch to see colleagues' events overlaid in grey
- **Month view**: Compact overview with event previews per day
- **Click to create**: Click any time slot (week) or day (month) to create an event pre-filled with that time
- **Entity linking**: Link events to any lead, contact, company, deal, project, or campaign
- **Edit**: Click any custom event to open detail dialog with edit mode
- **Invite**: Enter email addresses. Invitees receive an email with an `.ics` calendar file attachment
- **Invitees shown** as badges on the event detail
- **Color coding**: Purple (events), violet (calls), amber (tasks), indigo (deals), blue (Google), grey (team)
- **Blocking vs non-blocking**: Toggle `blocks_booking` per event. Blocking events prevent booking slots during that time. Non-blocking events (e.g. "Working from home") show a "non-blocking" label
- **Configurable hour range**: Dropdown selectors to change the visible time window (e.g. 00:00 to 23:00 for overnight events)
- **Booking engine integration**: The booking availability endpoint checks all blocking events when calculating open slots

#### Invite response
```json
{
  "invited": 2,
  "total_invitees": 3
}
```

#### Calendar Event Types
| Type | Source | Color |
|------|--------|-------|
| `call` | Scheduled calls | Purple `#A100FF` |
| `task` | Tasks with due dates | Amber `#f59e0b` (green if done) |
| `deal` | Deals with close dates | Indigo `#6366f1` |
| `event` | Custom events | Configurable |
| `google` | Google Calendar sync | Blue `#4285f4` |

---

### Google Calendar Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendar/google/auth-url` | Get Google OAuth consent URL |
| GET | `/api/auth/google/callback` | OAuth callback (automatic redirect) |
| GET | `/api/calendar/google/status` | Check if connected |
| GET | `/api/calendar/google/events` | Fetch Google Calendar events (30 days past, 90 days future) |
| DELETE | `/api/calendar/google/disconnect` | Disconnect Google Calendar |

#### Setup
1. Create OAuth 2.0 credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable **Google Calendar API**
3. Set authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`
4. Add to backend `.env`:
```env
GOOGLE_CLIENT_ID="your_client_id"
GOOGLE_CLIENT_SECRET="your_client_secret"
```
5. Users connect via **Calendar page → Connect Google** or **Settings → Integrations**

---

### Cross-linked Actions

From any Lead, Contact, or Deal detail dialog, users can trigger actions that navigate to the target page and auto-open the create dialog with the entity pre-linked:

| From | Action | Opens |
|------|--------|-------|
| Lead detail | "Add Deal" | Deals page with create dialog, lead_id pre-filled |
| Lead detail | "Add Task" | Tasks page with create dialog, lead_id pre-filled |
| Lead detail | "Discuss" | Chat page with contextual lead channel |
| Lead detail | "Draft Email" | AI email composer with lead context |
| Lead detail | "Convert to Contact" | Conversion dialog with deal linking |
| Contact detail | "Add Deal" | Deals page with create dialog, contact_id pre-filled |
| Contact detail | "Add Task" | Tasks page with create dialog |
| Contact detail | "Discuss" | Chat page with contextual channel |
| Deal detail | "Discuss" | Chat page with contextual deal channel |

The auto-open uses URL params (`?create=true&lead_id=xxx`) which the target page reads on mount.

---

### Chat (Internal, JWT auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/channels` | List channels (excludes archived) |
| POST | `/api/chat/channels` | Create channel |
| PUT | `/api/chat/channels/{id}/archive` | Archive channel (admin only) |
| GET | `/api/chat/channels/{channel_id}/messages` | Get messages. Params: `limit`, `before` |
| POST | `/api/chat/channels/{channel_id}/messages` | Post a message |
| PUT | `/api/chat/messages/{id}` | Edit message |
| DELETE | `/api/chat/messages/{id}` | Delete message |
| POST | `/api/chat/messages/{id}/react` | Toggle reaction |

**Channel types**: `general`, `lead`, `deal`, `project`

#### Post Message (JWT auth)
```http
POST /api/chat/channels/general/messages
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "content": "Hello team!",
  "channel_id": "general",
  "mentions": [],
  "reply_to": null,
  "attachments": []
}
```

**Response:**
```json
{
  "message_id": "msg_xxx",
  "channel_id": "general",
  "sender_id": "user_xxx",
  "sender_name": "Florian",
  "content": "Hello team!",
  "is_edited": false,
  "created_at": "2026-03-25T18:00:00Z"
}
```

---

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| POST | `/api/campaigns/{id}/send` | Send via Resend or Kit.com |

---

### Booking Engine

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/booking/settings` | JWT | Get booking settings |
| PUT | `/api/booking/settings` | JWT | Update booking settings |
| GET | `/api/booking/{user_id}/available` | Public | Get available time slots. Params: `date`, `duration` |
| POST | `/api/booking/{user_id}/book` | Public | Book a meeting. Params: `name`, `email`, `start_time`, `duration`, `notes`, `phone` |
| GET | `/api/bookings` | JWT | List your bookings |
| PUT | `/api/bookings/{id}/cancel` | Public | Cancel a booking |
| GET | `/api/booking/{user_id}/ical/{id}` | Public | Download .ics calendar file |

#### Public Booking Page
Share your booking link: `https://yourdomain.com/book/{your_user_id}`

Guests can:
- Select duration (15/30/60 min)
- Pick a date from the calendar
- Choose an available time slot
- Fill in their details and book

**Automation flow:**
1. Guest books a meeting
2. Confirmation email sent to guest (with .ics attachment)
3. Notification email sent to host
4. Reminder email sent 1 hour before
5. Lead auto-created from booking in your CRM
6. Event appears on your Calendar page

#### Booking Settings
```json
{
  "meeting_durations": [15, 30, 60],
  "working_hours_start": "09:00",
  "working_hours_end": "17:00",
  "working_days": [0, 1, 2, 3, 4],
  "buffer_minutes": 15,
  "timezone": "Europe/London",
  "welcome_message": "Book a meeting with us"
}
```

---

### Call Transcription

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/calls/{call_id}/transcribe` | Transcribe recording + generate follow-ups |

Transcription uses AI to generate:
- **Transcript summary** (3-5 sentences)
- **Key discussion points**
- **Action items** with priority (auto-created as tasks)
- **Sentiment** analysis
- **Next meeting** suggestion

Follow-up tasks are automatically created in your task board.

#### Response
```json
{
  "call_id": "call_xxx",
  "transcription": {
    "transcript_summary": "...",
    "key_points": ["Discussed pricing", "Agreed on timeline"],
    "action_items": [
      { "title": "Send proposal", "priority": "high" },
      { "title": "Schedule follow-up", "priority": "medium" }
    ],
    "sentiment": "positive",
    "next_meeting": "Review proposal details"
  },
  "tasks_created": 2
}
```

---

### Bulk Operations

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/bulk/delete` | `{ "entity_type": "lead", "entity_ids": ["id1", "id2"] }` |
| POST | `/api/bulk/update` | `{ "entity_type": "lead", "entity_ids": [...], "updates": { "status": "contacted" } }` |
| POST | `/api/bulk/enrich` | `{ "entity_type": "lead", "entity_ids": [...] }` |
| POST | `/api/bulk/add-to-campaign` | `{ "campaign_id": "xxx", "entity_type": "lead", "entity_ids": [...] }` |

**Entity types**: `lead`, `contact`, `company`, `deal`

---

### Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/organizations` | Create org |
| GET | `/api/organizations/current` | Get current user's org |
| GET | `/api/organizations/{id}/members` | List members |
| PUT | `/api/organizations/settings` | Update org settings |
| POST | `/api/invites/link` | Generate invite link |
| POST | `/api/invites/email` | Send email invites |
| POST | `/api/invites/csv` | Import invites via CSV |

---

### Admin (Super Admin / Deputy Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/users` | All users |
| POST | `/api/admin/users/create` | Create user (no signup needed) |
| PUT | `/api/admin/users/{id}/role` | Change user role |
| PUT | `/api/admin/users/{id}/password` | Reset user password |
| DELETE | `/api/admin/users/{id}` | Delete user |
| GET | `/api/admin/organizations` | All organizations |
| PUT | `/api/admin/organizations/{id}` | Edit org (name, plan, max_users, email_domain) |
| DELETE | `/api/admin/organizations/{id}` | Delete organization |
| GET | `/api/admin/analytics/users` | User analytics with org data |
| GET | `/api/admin/contact-requests` | Support requests |
| PUT | `/api/admin/contact-requests/{id}/status` | Update support status |
| GET | `/api/admin/discount-codes` | List discount codes |
| POST | `/api/admin/discount-codes` | Create discount code |
| GET | `/api/admin/affiliates` | List affiliates |
| GET | `/api/admin/data-explorer` | List collections |
| GET | `/api/admin/data-explorer/{collection}` | Browse collection |

#### Create User (Admin)
```http
POST /api/admin/users/create
Content-Type: application/json

{
  "email": "rep@company.com",
  "name": "Sales Rep",
  "password": "InitialPass123",
  "role": "member",
  "organization_id": "org_xxx"
}
```

#### Reset User Password
```http
PUT /api/admin/users/{user_id}/password
Content-Type: application/json

{ "new_password": "NewSecurePass456" }
```

#### Edit Organization (License Override)
```http
PUT /api/admin/organizations/{org_id}
Content-Type: application/json

{ "max_users": 50, "plan": "enterprise", "email_domain": "acme.com" }
```

---

### Reporting Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/reports/overview` | Platform overview (users, leads, pipeline, revenue, win rate) |
| GET | `/api/admin/reports/user-performance` | Performance per user (leads, deals, revenue, tasks, completion rate) |
| GET | `/api/admin/reports/pipeline-forecast` | Forecast by stage, by user, and by tag/product |
| GET | `/api/admin/reports/activity-log` | Activity over last N days. Param: `days` (default 30) |
| GET | `/api/admin/reports/export/{entity}` | CSV export. Entities: leads, contacts, deals, tasks, users, companies |

#### Overview Response
```json
{
  "total_users": 12,
  "total_leads": 27,
  "total_deals": 13,
  "pipeline_value": 247500,
  "won_revenue": 0,
  "win_rate": 0.0,
  "deals_won": 0,
  "deals_lost": 0
}
```

#### User Performance Response
```json
[
  {
    "name": "Florian",
    "email": "florian@unyted.world",
    "leads_created": 18,
    "deals_created": 5,
    "deals_won": 2,
    "revenue_won": 35000,
    "tasks_completed": 12,
    "tasks_total": 15,
    "task_completion_rate": 80.0,
    "last_login": "2026-03-25T10:00:00Z"
  }
]
```

#### Pipeline Forecast Response
```json
{
  "by_stage": {
    "qualified": { "count": 5, "value": 120000, "weighted": 72000 },
    "proposal": { "count": 3, "value": 85000, "weighted": 59500 }
  },
  "by_user": { "user_xxx": { "name": "Florian", "count": 4, "value": 90000, "weighted": 54000 } },
  "by_tag": { "enterprise": { "count": 2, "value": 75000, "weighted": 45000 } }
}
```

#### CSV Export
```bash
# Download all leads as CSV
curl -H "Authorization: Bearer TOKEN" \
  "https://earnrm.com/api/admin/reports/export/leads" -o leads.csv
```

---

## External API (v1)

For **n8n**, **Notion**, **Zapier**, and custom integrations.

### Authentication

```
X-API-Key: earnrm_your_key_here
```
or
```
Authorization: Bearer earnrm_your_key_here
```

Generate keys at **Settings → API & Webhooks**.

### Endpoints

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| GET | `/api/v1/leads` | `limit`, `status` | List leads |
| POST | `/api/v1/leads` | — | Create lead (same payload as internal) |
| GET | `/api/v1/contacts` | `limit` | List contacts |
| GET | `/api/v1/deals` | `limit`, `stage` | List deals |
| GET | `/api/v1/companies` | `limit` | List companies |
| GET | `/api/v1/tasks` | `limit`, `status` | List tasks |
| POST | `/api/v1/tasks` | — | Create task |
| POST | `/api/v1/notion/sync` | `entity_type` | Notion-formatted export |
| GET | `/api/v1/docs` | — | API documentation |
| GET | `/api/v1/chat/channels` | `channel_type` | List chat channels |
| POST | `/api/v1/chat/channels` | — | Create a chat channel |
| GET | `/api/v1/chat/messages/{channel_id}` | `limit`, `since`, `before` | Read messages |
| POST | `/api/v1/chat/messages` | — | Post a message (JSON body) |

### Example: Fetch Leads
```bash
curl -H "X-API-Key: earnrm_abc123..." \
  "https://earnrm.com/api/v1/leads?limit=10&status=qualified"
```

### Example: Create Lead via API
```bash
curl -X POST -H "X-API-Key: earnrm_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Jane","last_name":"Doe","email":"jane@corp.com","company":"Corp Inc"}' \
  "https://earnrm.com/api/v1/leads"
```

---

### Chat API (for AI Agents)

The Chat API enables fully bidirectional messaging. AI agents, bots, n8n workflows, and custom integrations can read and post messages to any channel, just like a human team member.

**All routes verified and working.** Minimum viable test:
```bash
# 1. List channels
curl -H "X-API-Key: earnrm_xxx" "https://earnrm.com/api/v1/chat/channels"

# 2. Resolve a channel by ID or name
curl -H "X-API-Key: earnrm_xxx" "https://earnrm.com/api/v1/chat/channels/general"

# 3. Post a message
curl -X POST -H "X-API-Key: earnrm_xxx" -H "Content-Type: application/json" \
  -d '{"channel_id":"general","content":"Hello from automation","sender_name":"My Bot"}' \
  "https://earnrm.com/api/v1/chat/messages"

# 4. Read messages
curl -H "X-API-Key: earnrm_xxx" "https://earnrm.com/api/v1/chat/messages/general?limit=10"
```

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/chat/channels` | List channels. Param: `channel_type` |
| GET | `/api/v1/chat/channels/{id}` | Get channel by ID or name (case-insensitive) |
| POST | `/api/v1/chat/channels` | Create a channel |
| GET | `/api/v1/chat/messages/{channel_id}` | Read messages. Params: `limit`, `since`, `before` |
| POST | `/api/v1/chat/messages` | Post a message (JSON body) |

#### Post Message Request
```json
{
  "channel_id": "general",
  "content": "Hello from automation",
  "sender_name": "Sales Bot",
  "reply_to": null,
  "metadata": {"source": "n8n", "workflow_id": "wf_123"}
}
```

#### Post Message Response
```json
{
  "message_id": "msg_xxx",
  "channel_id": "general",
  "sender_name": "Sales Bot",
  "content": "Hello from automation",
  "is_bot": true,
  "metadata": {"source": "n8n"},
  "created_at": "2026-04-07T18:00:00Z"
}
```

#### Read Messages Response
```json
{
  "data": [{"message_id": "msg_xxx", "sender_name": "Bot", "content": "Hello", "is_bot": true, "created_at": "..."}],
  "count": 1,
  "channel_id": "general",
  "has_more": false,
  "oldest": "2026-04-07T18:00:00Z",
  "newest": "2026-04-07T18:00:00Z"
}
```

#### Webhook for incoming messages
```bash
curl -X POST -H "Authorization: Bearer jwt_token" \
  "https://earnrm.com/api/webhooks?url=https://your-n8n.com/webhook/abc&events=chat.message&name=Chat+Listener"
```

#### AI Agent Pattern
1. Register a `chat.message` webhook pointing to your n8n Webhook Trigger
2. Filter messages where `is_bot` is false (human messages only)
3. Process with AI (OpenAI, Claude, etc.)
4. Post response via `POST /api/v1/chat/messages`

---

## Webhooks

Register webhook URLs to receive real-time event notifications.

### Register
```http
POST /api/webhooks?url=https://your-server.com/hook&events=lead.created&events=deal.stage_changed&name=My+Hook
Authorization: Bearer <token>
```

### Events
| Event | Trigger |
|-------|---------|
| `lead.created` | New lead added |
| `lead.updated` | Lead modified |
| `deal.created` | New deal created |
| `deal.stage_changed` | Deal moved to new stage |
| `contact.created` | New contact added |
| `task.created` | New task created |
| `chat.message` | Message posted in any channel |

### Payload Format
```json
{
  "event": "lead.created",
  "data": { "lead_id": "lead_xxx", "first_name": "John", "email": "john@acme.com", ... },
  "timestamp": "2026-03-23T12:00:00Z"
}
```

### Manage Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webhooks` | List registered webhooks |
| POST | `/api/webhooks` | Register new webhook |
| DELETE | `/api/webhooks/{id}` | Remove webhook |

---

## Integrations

### n8n.io
1. Generate API key at **Settings → API & Webhooks**
2. Use **HTTP Request** node: `GET https://earnrm.com/api/v1/leads`
3. Set header: `X-API-Key: earnrm_your_key`
4. For triggers: Register webhook → use n8n **Webhook Trigger** node URL

### Notion
```bash
POST /api/v1/notion/sync?entity_type=leads
X-API-Key: earnrm_your_key
```
Returns data formatted for Notion database API.

### Resend
Primary email service. Configure `RESEND_API_KEY` and `SENDER_EMAIL` in backend `.env`.

### Google Calendar
Two-way calendar sync. Configure in [Google Cloud Console](https://console.cloud.google.com):
1. Enable **Google Calendar API**
2. Create **OAuth 2.0 Client ID** (Web application)
3. Add redirect URI: `https://yourdomain.com/api/auth/google/callback`
4. Add to backend `.env`:
```env
GOOGLE_CLIENT_ID="your_client_id"
GOOGLE_CLIENT_SECRET="your_client_secret"
```
Users connect via **Calendar page → Connect Google** button.

### Twilio
Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_FROM` in backend `.env`.
Set inbound webhook: `https://yourdomain.com/api/webhooks/twilio/inbound`

### Stripe
Configure `STRIPE_API_KEY` in backend `.env`.

### Launch Edition Checkout

One-time EUR 4,999 purchase. Creates a deal, lead, and Stripe checkout session. On payment success, deal moves to "won" and a delivery task is auto-created.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/checkout/launch-edition` | Public | Start checkout. Body: `{ "origin_url", "name", "email" }` |
| GET | `/api/checkout/launch-edition/verify` | Public | Verify payment. Params: `session_id`, `deal_id` |

**Flow:**
1. Buyer clicks "Book a Setup Call" on landing page
2. Enters name and email, clicks checkout
3. Redirected to Stripe for EUR 4,999 payment
4. Deal created as "negotiation" (open opportunity)
5. On payment success: deal updated to "won", delivery task created, lead marked qualified

---

## API Keys

### Generate
```http
POST /api/api-keys?name=my_integration
Authorization: Bearer <token>

Response: { "key": "earnrm_abc123...", "key_id": "key_xxx" }
```
> Save the key immediately — it won't be shown again.

### List
```http
GET /api/api-keys
```

### Revoke
```http
DELETE /api/api-keys/{key_id}
```

---

## Multi-level Affiliate Program

Three-tier commission system. Anyone can self-enroll as an affiliate from Settings.

### Levels
| Level | Label | Own Commission | Upstream Commission | Total Payout |
|-------|-------|---------------|---------------------|-------------|
| 0 | Partner | 20% | - | 20% |
| 1 | Ambassador | 10% | Level 0 gets 10% | 30% |
| 2 | Advocate | 10% | Level 1 gets 10%, Level 0 gets 10% | 40% |

- **Maximum total payout**: 60% (you retain minimum 40%)
- **Customer discount**: Every affiliate link gives new customers 20% off
- Commissions active as long as the subscription is paid

### Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/affiliate/enroll` | Self-enroll (calculates level from referral chain) |
| GET | `/api/affiliate/me` | Full dashboard: level, commission, link, assets, referrals |
| POST | `/api/affiliate/unenroll` | Leave affiliate program |

### How levels are determined
1. You invite someone: they register with `?ref=your_code`, stored as `referred_by` on their user doc
2. When they enroll as affiliate, the system checks their `referred_by` chain
3. If referred by a Level 0, they become Level 1. If referred by Level 1, they become Level 2.

### Each affiliate gets
- Unique referral link (`earnrm.com/signup?ref=code`)
- Level badge (Partner / Ambassador / Advocate)
- Commission summary explaining their earning structure
- 3 social media assets (Banner, Story, Square)
- HTML embed code with their link for CMS integration

---

## Per-Organization Integrations

Each organization manages their own integration API keys. New orgs start with blank integrations.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/integrations` | Get org integration keys (admins see keys, members see status only) |
| PUT | `/api/settings/integrations` | Update org integration keys (admin/owner only) |

### Available integration fields
| Key | Service |
|-----|---------|
| `resend_api_key` | Resend email |
| `resend_sender_email` | Sender email address |
| `kit_api_key` | Kit.com (ConvertKit) |
| `kit_api_secret` | Kit.com secret |
| `twilio_sid` | Twilio Account SID |
| `twilio_token` | Twilio Auth Token |
| `twilio_phone` | Twilio phone number |
| `google_client_id` | Google Calendar OAuth |
| `google_client_secret` | Google Calendar secret |

> License payments still go to the platform owner (super admin Stripe account). Only operational integrations (email, calling, calendar) use per-org keys.

---

## UNYT Token Payment

Alternative payment method using UNYT tokens on Arbitrum One.

| Detail | Value |
|--------|-------|
| Token | UNYT (ERC-20) |
| Contract | `0x5305bF91163D97D0d93188611433F86D1bb69898` |
| Chain | Arbitrum One (42161) |
| Receiving wallet | `0xFf98458bEBA08e0a8967D45Ce216D9Ee5fdecD1A` |
| Price | EUR 0.50 per UNYT |
| Decimals | 18 |

### Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/checkout/launch-edition/unyt` | Create UNYT payment order. Body: `{ name, email, wallet }` |
| POST | `/api/checkout/launch-edition/unyt/confirm` | Confirm after tx. Params: `deal_id`, `tx_hash` |

### Flow
1. User selects "Pay with UNYT" on checkout
2. MetaMask connects and switches to Arbitrum
3. ERC-20 transfer of UNYT tokens to receiving wallet
4. Backend creates deal as "negotiation", lead as "qualified"
5. On tx confirmation: deal moves to "won", delivery task created

### Subscription payments with UNYT
Available on the pricing page via the "Pay with UNYT Token" toggle. Connects MetaMask, calculates UNYT amount at EUR 0.50 per token, and sends directly.

---

## Customizable Stages

Organizations can customize deal pipeline stages and task status groups.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/stages` | Get custom stages (defaults if not set) |
| PUT | `/api/settings/stages` | Update stages (admin/owner only) |

### Default deal stages
`lead` > `qualified` > `proposal` > `negotiation` > `won` / `lost`

### Default task statuses
`todo` > `in_progress` > `done`

### Example: Add a custom deal stage
```http
PUT /api/settings/stages
Content-Type: application/json

{
  "deal_stages": [
    {"id": "lead", "name": "Lead"},
    {"id": "discovery", "name": "Discovery"},
    {"id": "qualified", "name": "Qualified"},
    {"id": "proposal", "name": "Proposal"},
    {"id": "negotiation", "name": "Negotiation"},
    {"id": "won", "name": "Won"},
    {"id": "lost", "name": "Lost"}
  ]
}
```

---

## Discount Code Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/discount-codes` | List all codes |
| POST | `/api/admin/discount-codes` | Create code |
| PUT | `/api/admin/discount-codes/{code_id}` | Edit code (code, discount_percent, max_uses, valid_until, is_active) |
| DELETE | `/api/admin/discount-codes/{code_id}` | Delete code |

---

## Task Management

Full task system with Kanban drag-and-drop, list view, subtasks, comments, activity history, and project integration.

### Views
- **Kanban**: Drag tasks between To Do, In Progress, Done columns
- **List**: Sortable table with inline status dropdowns

### Task Detail Features
- Stable description at the top (editable)
- **Subtasks tab**: Add checklist items, toggle complete/incomplete, progress count shown on cards
- **Updates tab**: Timestamped progress notes, blockers, handoff comments with author name
- **History tab**: Auto-logged activity on every change (status, priority, owner, due date)
- **Reopen**: Done tasks get a "Reopen" button, event logged in history
- **Stale indicator**: Amber "stale" badge on tasks not updated for 7+ days

### Task Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks. Params: `status`, `assigned_to` |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/{task_id}` | Update task (auto-logs activity for tracked fields) |
| DELETE | `/api/tasks/{task_id}` | Delete task |
| POST | `/api/tasks/{task_id}/comments` | Add comment. Param: `content` |
| POST | `/api/tasks/{task_id}/subtasks` | Add subtask. Param: `title` |
| PUT | `/api/tasks/{task_id}/subtasks/{sub_id}` | Toggle subtask. Param: `done` |
| POST | `/api/tasks/{task_id}/reopen` | Reopen a completed task |

### Tasks inside Projects
Tasks in the project detail dialog are fully interactive: click to open the same detail view with subtasks, comments, and history. No need to leave the project context.

---

## File Storage

Upload files and link them to any entity. AI auto-analyzes the content and suggests follow-up actions.

### Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload` | Upload file. Params: `linked_type`, `linked_id`, `description`. Multipart form: `file` |
| GET | `/api/files` | List files. Params: `linked_type`, `linked_id` |
| GET | `/api/files/{file_id}/download` | Download a file |
| DELETE | `/api/files/{file_id}` | Delete a file |
| POST | `/api/files/{file_id}/create-tasks` | Create follow-up tasks from AI analysis |

### Linkable entity types
`lead`, `contact`, `company`, `deal`, `project`, `campaign`, `task`

### AI analysis
On upload, the system automatically:
- **Text/PDF/CSV files**: Summarizes content in 2-3 sentences, suggests follow-up actions
- **Images**: Describes the image, suggests follow-ups
- Returns `ai_summary` with `summary` and `follow_ups` array
- Follow-ups can be converted to tasks via `POST /files/{id}/create-tasks`

### File size
Default maximum: 10MB per file. Configurable per organization via `max_file_size` in org integration settings.

### Example
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -F "file=@proposal.pdf" \
  "https://earnrm.com/api/files/upload?linked_type=deal&linked_id=deal_xxx&description=Q2+proposal"
```

---

## Lead Capture Tool

Mobile-friendly business card scanner for conferences and events. Snap a photo, AI extracts the contact info, creates a lead, enriches it, and triggers a follow-up.

### How it works
1. Open `/capture` or `/capture/{event-name}` on your phone
2. Tap "Take Photo" to snap a business card
3. AI (GPT Vision) extracts: name, email, phone, company, title, website
4. Lead created with event tag and AI enrichment
5. System either sends a follow-up email or creates a high-priority task

### Capture page
- `/capture` (general capture)
- `/capture/WebSummit2026` (pre-tagged with event name)

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/capture` | JWT | Capture business card. Multipart form: `file` (image), `event_name`, `auto_email` |
| POST | `/api/v1/capture` | API Key | Same endpoint for external integrations (n8n, bots) |

### Request
```bash
curl -X POST -H "X-API-Key: earnrm_xxx" \
  -F "file=@business_card.jpg" \
  -F "event_name=DMEXCO 2026" \
  -F "auto_email=false" \
  "https://earnrm.com/api/v1/capture"
```

### Response
```json
{
  "lead_id": "lead_xxx",
  "extracted": {
    "first_name": "Anna",
    "last_name": "Mueller",
    "email": "anna@firma.de",
    "company": "Firma GmbH",
    "job_title": "Head of Sales",
    "phone": "+49 170 1234567"
  },
  "enrichment": {
    "industry": "Technology",
    "recommended_approach": "Lead with ROI data..."
  },
  "event": "DMEXCO 2026",
  "follow_up": "task_created",
  "message": "Lead captured from DMEXCO 2026"
}
```

### Follow-up behavior
- **auto_email=true**: Sends "Great meeting you at {event}" email via Resend
- **auto_email=false** (default): Creates a high-priority follow-up task assigned to the capturer

### Integration with WhatsApp/Telegram
Use the external API endpoint (`POST /api/v1/capture`) as the backend for a WhatsApp or Telegram bot via n8n:
1. Bot receives photo from user
2. n8n sends it to `/api/v1/capture` with event name
3. Lead created, enriched, follow-up triggered

---

## Password Reset

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/forgot-password` | Send reset email. Param: `email` |
| POST | `/api/auth/reset-password` | Set new password. Params: `token`, `new_password` |

- Reset link sent via Resend email, expires in 1 hour
- If email not registered, shows helpful message with link to sign up
- Tokens are single-use

---

## Internationalization (i18n)

The app supports English and German. Language toggle available in the sidebar (EN/DE button) and on the landing page nav.

### How it works
- Translation files: `/src/locales/en.json` and `/src/locales/de.json`
- Language persists in `localStorage` (key: `earnrm_lang`)
- Uses `react-i18next` for the landing page, and a lightweight `useT()` helper for dashboard pages

### What is translated
- Landing page (hero, features, pricing, testimonials, CTA, footer)
- Sidebar navigation
- Login, signup, password reset pages
- Page titles, button labels, form fields across all pages
- Task statuses, deal stages, filter labels

### Adding a new language
1. Create `/src/locales/xx.json` (copy `en.json` as template)
2. Add the resource to `/src/i18n.js`
3. Add toggle option to DashboardLayout sidebar

---

## Roles & Permissions

| Role | Scope |
|------|-------|
| `super_admin` | Full platform access, Data Explorer, delete users/orgs, discount codes, license override |
| `deputy_admin` | Same as super_admin |
| `support` | View & manage support requests |
| `owner` | Full org access, manage members, billing |
| `admin` | Org management, archive channels, pipeline visibility |
| `member` | Own leads, deals, tasks, contacts |

---

## Database Collections

| Collection | Description |
|-----------|-------------|
| `users` | User accounts with roles and last_login |
| `organizations` | Multi-tenant orgs with license limits and email_domain |
| `leads` | Sales leads with AI scoring & enrichment |
| `contacts` | Converted leads with sales profiles |
| `deals` | Pipeline deals with stage tracking |
| `tasks` | Team tasks with project linking |
| `projects` | Multi-task projects linked to deals |
| `companies` | Target companies |
| `campaigns` | Email campaigns |
| `calls` | Call logs (inbound & outbound) |
| `scheduled_calls` | Scheduled call reminders |
| `chat_channels` | Team chat channels (general, lead, deal, project) |
| `messages` | Chat messages with reactions |
| `api_keys` | External API keys (bcrypt hashed) |
| `webhooks` | Registered webhook endpoints |
| `affiliates` | Affiliate program members |
| `affiliate_referrals` | Referral tracking |
| `discount_codes` | Promotional codes |
| `invoices` | Payment invoices |
| `payment_transactions` | Stripe transactions |
| `contact_requests` | Support form submissions |
| `notifications` | User notifications |
| `calendar_events` | Custom calendar events |
| `google_calendar_tokens` | Google OAuth tokens for Calendar sync |
| `google_calendar_states` | OAuth state verification |
| `bookings` | Calendar booking appointments |
| `booking_settings` | User booking page settings |
| `booking_reminders` | Scheduled booking reminders |
| `org_integrations` | Per-organization API keys for integrations |
| `org_stage_settings` | Customizable deal stages and task statuses per org |
| `password_resets` | Password reset tokens |
| `affiliate_referrals` | Referral tracking with upstream commission chain |

---

## License

Proprietary — earnrm by Finerty Ltd. All rights reserved.

Canbury Works, Units 6 and 7, Canbury Business Park, Elm Crescent, Kingston upon Thames, Surrey, KT2 6HJ, UK
