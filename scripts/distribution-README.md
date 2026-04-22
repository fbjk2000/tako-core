# TAKO CRM — Self-Hosted Installation Guide

Welcome to TAKO — the AI-native CRM for European sales teams.

## Quick start (Docker)

1. Copy `.env.example` to `.env` and fill in your values
2. Run: `docker-compose -f docker-compose.production.yml up -d`
3. Access TAKO at http://your-server:3000
4. The first user to register becomes the organization owner

## Requirements

- Docker and Docker Compose
- MongoDB 6+ (included in docker-compose)
- 2GB RAM minimum, 4GB recommended
- An Anthropic API key for AI features (get one at console.anthropic.com)

## First login

After starting TAKO, register your admin account. You'll see an onboarding
checklist on the dashboard that walks you through:

- Setting up your profile and timezone
- Configuring integrations (email, calendar, calling)
- Importing your first leads
- Creating your deal pipeline

Training modules are available in the app under Support.

## Environment variables

See `.env.example` for all configuration options with descriptions.

## Integrations

TAKO supports these integrations — configure them in Settings > Integrations:

- **Email**: Resend (transactional) + Kit.com (marketing campaigns)
- **Calendar**: Google Calendar sync
- **Calling**: Twilio (inbound + outbound)
- **Social**: Meta (WhatsApp Business, Facebook, Instagram)
- **AI**: Anthropic Claude (included with your license)

## Backups

Run `scripts/backup-mongo.sh` daily. Add to crontab:

```
0 3 * * * MONGO_URL="mongodb://localhost:27017" DB_NAME="tako" /opt/tako/scripts/backup-mongo.sh >> /var/log/tako-backup.log 2>&1
```

## Updating

1. Back up your MongoDB data
2. Download the new version from your TAKO account
3. Replace the application files (keep your `.env`)
4. Run: `docker-compose -f docker-compose.production.yml up -d --build`

## Maintenance and support

Your license includes 12 months of maintenance and support.

- Email: support@tako.software
- In-app: Support page with FAQ, contact form, and training modules

After Year 1, optionally renew for €999/year to continue receiving updates
and priority support.

## License

Proprietary — TAKO by Fintery Ltd. All rights reserved.
You have a perpetual license to use, modify, and deploy TAKO on your
own infrastructure. Redistribution or resale is not permitted.
