#!/usr/bin/env python3
"""Backfill `channel_type` on existing campaigns.

Spec reference: docs/facebook-listener-spec.md §Phase 0 P1.

Usage (from repo root):
    python scripts/migrate_campaigns_add_channel.py

Idempotent: only touches campaigns that don't have the field yet.

Reads MONGO_URL and DB_NAME from the same env as the backend (backend/.env).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _load_env() -> None:
    try:
        from dotenv import load_dotenv

        backend_env = Path(__file__).resolve().parent.parent / "backend" / ".env"
        if backend_env.exists():
            load_dotenv(backend_env)
    except ImportError:
        pass  # dotenv optional


def main() -> int:
    _load_env()
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not (mongo_url and db_name):
        print("MONGO_URL / DB_NAME missing — abort.", file=sys.stderr)
        return 1

    from pymongo import MongoClient

    client = MongoClient(mongo_url)
    db = client[db_name]
    result = db.campaigns.update_many(
        {"channel_type": {"$exists": False}},
        {"$set": {"channel_type": "email"}},
    )
    print(
        f"Backfilled channel_type='email' on {result.modified_count} campaigns "
        f"(matched {result.matched_count})."
    )
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
