# EarnRM Source Database Backup

## What is this?
Authoritative MongoDB backup of the EarnRM CRM database for self-hosted cloning.

## Details
- **Date**: 2026-04-11
- **Source**: earnrm-preview (Emergent Platform)
- **Database**: test_database
- **Collections**: 27
- **Documents**: 211
- **Format**: mongodump (BSON) + JSON export in a single tar.gz

## How to restore
```bash
tar -xzf earnrm-source-database-backup-2026-04-11.tar.gz

# Restore to a local MongoDB instance
mongorestore --db earnrm mongodump_full/test_database/
```

## Contents
The backup includes all collections: users, organizations, leads, contacts, deals, tasks, projects, companies, campaigns, calls, chat channels, messages, calendar events, bookings, files, affiliates, API keys, webhooks, discount codes, payment transactions, and more.
