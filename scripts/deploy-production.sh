#!/usr/bin/env bash
set -euo pipefail

# TAKO Production Deployment Script
# Run this ON THE VPS to deploy or update TAKO.
#
# Prerequisites:
#   1. Docker and Docker Compose installed
#   2. DNS A record: tako.software → this server's IP
#   3. DNS A record: clients.earnrm.com → this server's IP (for redirect)
#   4. Port 80 and 443 open in firewall
#
# First-time setup:
#   git clone https://github.com/fbjk2000/tako-core.git /opt/tako
#   cd /opt/tako
#   bash scripts/deploy-production.sh --init
#
# Update:
#   cd /opt/tako
#   bash scripts/deploy-production.sh

DEPLOY_DIR="${DEPLOY_DIR:-/opt/tako}"

cd "$DEPLOY_DIR"

# ── Parse flags ───────────────────────────────────────────────
INIT=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --init) INIT=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── First-time init ──────────────────────────────────────────
if $INIT; then
  echo "=== First-time setup ==="

  # Create env files from templates if they don't exist
  if [ ! -f backend/.env ]; then
    cp backend/.env.production.template backend/.env
    echo "Created backend/.env — EDIT THIS FILE with real values before continuing."
    echo "  nano backend/.env"
    echo ""
    echo "Required changes:"
    echo "  - JWT_SECRET (generate with: openssl rand -hex 32)"
    echo "  - FRONTEND_URL=https://tako.software"
    echo "  - PUBLIC_URL=https://tako.software"
    echo "  - DB_NAME=tako_production"
    echo "  - SUPER_ADMIN_EMAIL=florian@unyted.world"
    exit 1
  fi

  if [ ! -f frontend/.env ]; then
    cp frontend/.env.production.template frontend/.env
    echo "Created frontend/.env — EDIT THIS FILE:"
    echo "  REACT_APP_BACKEND_URL=https://tako.software"
    exit 1
  fi
fi

# ── Verify env files exist ───────────────────────────────────
if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env not found. Run with --init first." >&2
  exit 1
fi
if [ ! -f frontend/.env ]; then
  echo "ERROR: frontend/.env not found. Run with --init first." >&2
  exit 1
fi

# ── Pull latest code ─────────────────────────────────────────
echo "=== Pulling latest from tako-core ==="
git pull origin main

# ── Stop old containers if using the dev compose file ────────
if docker compose ps --quiet 2>/dev/null | grep -q .; then
  echo "=== Stopping old dev containers ==="
  docker compose down
fi

# ── Detect edge-proxy strategy ───────────────────────────────
# If host-level nginx is already listening on :80/:443 (typical on this VPS
# where nginx also serves other sites), use the host-nginx override so Caddy
# doesn't try to bind those ports and backend/frontend publish to localhost
# where host nginx can proxy to them.
COMPOSE_FILES=(-f docker-compose.production.yml)
if ss -tln '( sport = :80 or sport = :443 )' 2>/dev/null | grep -qE 'LISTEN.*(:80|:443) '; then
  if [ -f docker-compose.host-nginx.yml ]; then
    echo "=== Detected host-level service on :80/:443 — using host-nginx override ==="
    COMPOSE_FILES+=(-f docker-compose.host-nginx.yml)
  else
    echo "WARN: host-level service is on :80/:443 but docker-compose.host-nginx.yml is missing." >&2
    echo "      Caddy will likely fail to bind. Either stop host nginx or add the override." >&2
  fi
else
  echo "=== Ports 80/443 free — using Caddy-in-docker as the edge proxy ==="
fi

# ── Build and start with production compose ──────────────────
echo "=== Building and starting production stack ==="
docker compose "${COMPOSE_FILES[@]}" up -d --build

# ── Wait for health ──────────────────────────────────────────
echo "=== Waiting for services ==="
sleep 5

echo ""
echo "=== Service status ==="
docker compose "${COMPOSE_FILES[@]}" ps

# Only show Caddy logs if Caddy is actually part of this deployment
if docker compose "${COMPOSE_FILES[@]}" ps --services 2>/dev/null | grep -q '^caddy$'; then
  echo ""
  echo "=== Caddy logs (check for SSL cert) ==="
  docker compose "${COMPOSE_FILES[@]}" logs caddy --tail 20
fi

echo ""
echo "=== Backend health ==="
curl -sf http://localhost:8001/api/health && echo " OK" || echo " FAILED — check backend logs"

echo ""
echo "=== Done ==="
echo "TAKO should now be live at https://tako.software"
echo ""
echo "If SSL isn't working yet, check:"
echo "  1. DNS: dig tako.software (should show this server's IP)"
echo "  2. Ports: ensure 80 and 443 are open"
echo "  3. Caddy logs: docker compose -f docker-compose.production.yml logs caddy"
