# Listeners (SMM agents)

Implementation of `docs/facebook-listener-spec.md` Phase 0 + Phase 1.

## Layout

| File | Purpose |
|---|---|
| `models.py` | Pydantic models: `Listener`, `ListenerConfig`, `ListenerSource`, `ListenerHit`, `ListenerReport`. |
| `indexes.py` | `ensure_indexes()` — called at startup to create all Mongo indexes. |
| `skills.py` | Three agent skills: `discover_groups`, `classify_hit`, `generate_report`. |
| `poller.py` | APScheduler jobs: `poll_meta_pages`, `rescore_hits`, `generate_digest`. |
| `routes.py` | `bind_deps(...)` → REST API for listeners/sources/hits/reports/discover. |
| `pairing.py` | `bind_pairing(...)` → Chrome extension device-code pairing. |
| `webhook_ingest.py` | `bind_webhook_router(...)` → `/api/webhooks/{provider}/{org_id}`. |
| `oauth_routes.py` | `bind_oauth_router(...)` → Meta OAuth authorize + callback. |
| `data_deletion.py` | `bind_data_deletion(...)` → Meta data-deletion webhook + public status lookup. |

All `bind_*` functions are called from `server.py` at the bottom, right before
`app.include_router`, so that `db`, `get_current_user`, `ensure_user_org`,
`tako_ai_text` are already defined.

## Default answers to spec §7 open questions

**Q1. Meta app — new or reuse?** New dedicated Tako Meta app. Reason: keeps
scopes scoped to Tako product, makes review submission clean. Stored env vars:
`META_APP_ID`, `META_APP_SECRET`.

**Q2. Kanban column for Listener tasks?** New `to_review` status (set in
`_create_listener_task`). Requires frontend Kanban to know this column —
frontend change is out of scope for this PR but tasks will sort correctly.

**Q3. Auto-create Lead on high-confidence `buying_signal`?** Default OFF, gated
by `ListenerConfig.auto_create_lead_on_buying_signal`. Implementation stub —
the toggle exists, the Lead creation path is wired in a follow-up (needs
agreement on dedupe key: email vs. profile_url).

**Q4. Default assignee?** `ListenerConfig.default_assignee_id`. Falls back to
`listener.created_by` if unset. This removes the per-campaign ambiguity.

## Not in this PR

- Frontend changes (spec §5) — Listener detail page, sources/hits/reports tabs.
- Chrome extension bundle (`tako-chrome-extension` is its own repo per spec).
- Migration off the existing `send_campaign_via_kit` flow — wrapped, not rewritten.
- Encryption of stored OAuth tokens — tracked separately.
- Google OAuth generalization — deferred; Meta uses the new framework cleanly.
- Stripe / Twilio webhook consolidation — left intact to avoid churn.

## Testing

- `pytest backend/tests/test_listeners.py -k "not integration"` for units.
- Integration tests require a running Mongo; see `test_result.md`.

## Running migrations

```
python scripts/migrate_campaigns_add_channel.py
```

Idempotent — safe to re-run.
