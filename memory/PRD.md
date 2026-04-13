# earnrm CRM - Product Requirements Document

## Overview
earnrm - "Your CRM that pAIs you back". AI-powered CRM.

## Access
- **Email**: florian@unyted.world | **Password**: DavidConstantin18

## Technical Stack
React, TailwindCSS, Shadcn UI | FastAPI, Motor, MongoDB | JWT + Google OAuth | Stripe | Resend | GPT-5.2 | Twilio (+443330155007)

## Roles
- super_admin, deputy_admin: Full access + Data Explorer + Discount codes + Delete users/orgs + Edit orgs
- support: Support request management
- owner/admin/member: Organization-level

## Implemented Features
- [x] Full CRM (Leads, Deals, Tasks, Companies, Campaigns, Contacts)
- [x] AI: scoring, email, search, summary, call analysis, enrichment
- [x] Deals: Kanban ↔ List view, Lost deals excluded from pipeline totals
- [x] Admin: Delete users + organizations, Edit orgs, Set license limits
- [x] Auto-org attribution by company email domain
- [x] **API Keys** — Generate/revoke API keys for programmatic access
- [x] **External API (v1)** — REST endpoints for leads, contacts, deals, companies, tasks
- [x] **Webhooks** — Register webhook URLs for events (lead.created, deal.stage_changed, etc.)
- [x] **n8n.io integration** — HTTP Request nodes + Webhook triggers via API keys
- [x] **Notion sync** — /v1/notion/sync endpoint formats data for Notion databases
- [x] **API docs** — /v1/docs endpoint with full integration guide
- [x] Select All + bulk operations, column visibility
- [x] Cross-linked actions (Convert, Enrich, Draft Email, Add Deal/Task from anywhere)
- [x] Scrollable dialogs, Admin sidebar visibility, CORS fix for Safari
- [x] Calling, Recording, AI Analysis, Scheduling, Inbound calls
- [x] Team Chat, Invitations, PWA, Affiliate program
- [x] Auto-Lead from signups, affiliate referral tracking

## API Endpoints (External)
- GET /api/v1/leads, POST /api/v1/leads
- GET /api/v1/contacts, GET /api/v1/deals, GET /api/v1/companies, GET /api/v1/tasks
- POST /api/v1/notion/sync
- GET /api/v1/docs
- Auth: X-API-Key header
