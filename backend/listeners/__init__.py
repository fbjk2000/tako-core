"""Listeners package — SMM agents for social listening.

Entrypoints from server.py:

    from listeners.routes import bind_deps as bind_listener_deps
    from listeners.pairing import bind_pairing
    from listeners.webhook_ingest import bind_webhook_router
    from listeners.oauth_routes import bind_oauth_router
    from listeners.indexes import ensure_indexes
    from listeners.poller import reschedule_all_listeners

Each `bind_*` function takes the monolith's globals (get_current_user, db, …)
and returns an APIRouter that server.py then includes.
"""
