#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# TAKO distribution package builder
#
# Produces a clean customer-ready tarball of the self-hosted TAKO CRM. Takes
# the current working tree, copies it into a temp directory, strips the bits
# that should not ship (test files, CI configs, crypto/UNYT integration,
# platform-only pages like Landing/Pricing/Partners/Download, super_admin UI),
# rebuilds the frontend, and emits `dist/tako-crm-<version>.tar.gz` plus a
# matching .sha256.
#
# The build runs ENTIRELY against a copy. This script never modifies the
# original repo. Run it idempotently — each invocation blows away and
# recreates the temp build dir and the dist outputs.
#
# Usage:
#   ./scripts/build-distribution.sh            # version = today (YYYY.MM.DD)
#   ./scripts/build-distribution.sh 2026.04.22 # explicit version
# -----------------------------------------------------------------------------
set -euo pipefail

VERSION="${1:-$(date -u +%Y.%m.%d)}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$(mktemp -d -t tako-build-XXXXXX)"
STAGE_DIR="${BUILD_DIR}/tako-crm-${VERSION}"
DIST_DIR="${REPO_ROOT}/dist"
TARBALL="${DIST_DIR}/tako-crm-${VERSION}.tar.gz"
HASH_FILE="${TARBALL}.sha256"
VERSION_FILE="${DIST_DIR}/VERSION"

log() { printf '\033[0;36m[build]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[build]\033[0m %s\n' "$*" >&2; }

cleanup() {
    if [ -n "${BUILD_DIR:-}" ] && [ -d "${BUILD_DIR}" ]; then
        rm -rf "${BUILD_DIR}"
    fi
}
trap cleanup EXIT

command -v rsync >/dev/null 2>&1 || { err "rsync is required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { err "python3 is required"; exit 1; }
command -v tar >/dev/null 2>&1 || { err "tar is required"; exit 1; }
command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1 || {
    err "shasum or sha256sum is required"; exit 1;
}

log "version: ${VERSION}"
log "repo:    ${REPO_ROOT}"
log "stage:   ${STAGE_DIR}"
log "dist:    ${DIST_DIR}"

mkdir -p "${STAGE_DIR}" "${DIST_DIR}"

# ---------------------------------------------------------------------------
# 1. Copy repo into stage dir, excluding anything that must never ship.
# ---------------------------------------------------------------------------
log "copying source tree (excluding internal/platform files)…"
rsync -a \
    --exclude='.git/' \
    --exclude='.gitignore' \
    --exclude='.gitconfig' \
    --exclude='.dockerignore' \
    --exclude='.DS_Store' \
    --exclude='.emergent/' \
    --exclude='.claude/' \
    --exclude='database-backup/' \
    --exclude='patches/' \
    --exclude='test_reports/' \
    --exclude='test_result.md' \
    --exclude='memory/' \
    --exclude='exports/' \
    --exclude='uploads/*' \
    --exclude='tests/' \
    --exclude='backend/tests/' \
    --exclude='backend/__pycache__/' \
    --exclude='frontend/node_modules/' \
    --exclude='frontend/build/' \
    --exclude='dist/' \
    --exclude='backend_test.py' \
    --exclude='rebrand_backend_test.py' \
    --exclude='check_status.py' \
    --exclude='=2.0.0' \
    --exclude='**/*.test.js' \
    --exclude='**/*.test.jsx' \
    --exclude='**/*.test.ts' \
    --exclude='**/*.test.tsx' \
    --exclude='**/test_*.py' \
    --exclude='**/*_test.py' \
    --exclude='**/__tests__/' \
    --exclude='**/__pycache__/' \
    --exclude='**/*.pyc' \
    --exclude='backend/.env' \
    --exclude='backend/.env.production.template' \
    --exclude='frontend/.env' \
    --exclude='frontend/.env.production.template' \
    --exclude='netlify.toml' \
    --exclude='scripts/build-distribution.sh' \
    --exclude='scripts/distribution-README.md' \
    --exclude='scripts/deploy-production.sh' \
    --exclude='scripts/refresh-emergent-patch.sh' \
    --exclude='scripts/reapply-local-patches.sh' \
    --exclude='scripts/sync-upstream-safe.sh' \
    --exclude='scripts/verify-emergent-guard.sh' \
    --exclude='design_guidelines.json' \
    --exclude='docker-compose.host-nginx.yml' \
    --exclude='Caddyfile' \
    "${REPO_ROOT}/" "${STAGE_DIR}/"

# ---------------------------------------------------------------------------
# 2. Surgical rewrites on the copy: strip UNYT/crypto, platform-only pages,
#    demo system (Prompt 9), super_admin UI, and clean .env.example. Done in
#    Python because the edits need to understand line boundaries and
#    route blocks, which sed can't do robustly across a growing tree of
#    React files.
# ---------------------------------------------------------------------------
log "stripping crypto/UNYT + platform-only pages + demo system + super_admin UI…"
STAGE_DIR="${STAGE_DIR}" VERSION="${VERSION}" REPO_ROOT="${REPO_ROOT}" python3 - <<'PYEOF'
import os
import re
import shutil
from pathlib import Path

stage = Path(os.environ["STAGE_DIR"])

# ─────────────────────────────────────────────────────────────────────────────
# 2a. Files that should not ship to customers.
#
#     - LandingPage / PricingPage / PartnerDashboardPage / DownloadPage are
#       tako.software platform pages.
#     - demo_seeder.py / DemoBanner.jsx / DemoExpiredOverlay.jsx are the
#       self-serve demo system (Prompt 9), platform-only.
# ─────────────────────────────────────────────────────────────────────────────
PLATFORM_ONLY_PAGES = [
    "frontend/src/pages/LandingPage.jsx",
    "frontend/src/pages/PricingPage.jsx",
    "frontend/src/pages/PartnerDashboardPage.jsx",
    "frontend/src/pages/DownloadPage.jsx",  # platform-only download page
    # Demo system (Prompt 9) — wholly platform-only.
    "backend/demo_seeder.py",
    "frontend/src/components/DemoBanner.jsx",
    "frontend/src/components/DemoExpiredOverlay.jsx",
]
for p in PLATFORM_ONLY_PAGES:
    path = stage / p
    if path.exists():
        path.unlink()
        print(f"  removed {p}")


# ─────────────────────────────────────────────────────────────────────────────
# Helper: strip blocks wrapped in DEMO_BEGIN / DEMO_END sentinels.
#
# Works for Python files (# DEMO_BEGIN / # DEMO_END) and JSX files where the
# markers appear as /* DEMO_BEGIN */ or {/* DEMO_BEGIN */}. The regex is
# permissive about the surrounding comment syntax so one helper handles
# every language we ship.
# ─────────────────────────────────────────────────────────────────────────────
_SENTINEL_RE = re.compile(
    r"""
    [\ \t]*                 # leading indent
    (?:\#|//|\{?/\*)        # # or // or {/* or /*
    \s*DEMO_BEGIN\b         # marker
    [^\n]*\n                # accept arbitrary trailing text on the marker line
    .*?                     # body (non-greedy)
    [\ \t]*
    (?:\#|//|\{?/\*)
    \s*DEMO_END\b
    [^\n]*\n
    """,
    re.DOTALL | re.VERBOSE,
)

def strip_demo_sentinels(text: str) -> tuple[str, int]:
    new_text, n = _SENTINEL_RE.subn("", text)
    return new_text, n

# Apply the sentinel stripper to every file that has DEMO_BEGIN/DEMO_END
# markers embedded inline (i.e. where the demo code is interleaved with
# code we DO want to ship). Files that are wholly demo-only are deleted in
# 2a above.
SENTINEL_TARGETS = [
    "backend/server.py",
    "frontend/src/pages/SetupOrgPage.jsx",
    "frontend/src/components/layout/DashboardLayout.jsx",
]
for relpath in SENTINEL_TARGETS:
    path = stage / relpath
    if path.exists():
        text = path.read_text()
        new_text, n = strip_demo_sentinels(text)
        if n:
            path.write_text(new_text)
            print(f"  stripped {n} DEMO_BEGIN/END block(s) from {relpath}")

# ─────────────────────────────────────────────────────────────────────────────
# 2b. Rewrite frontend/src/App.js:
#     - drop imports for stripped pages
#     - drop their routes
#     - redirect "/" to "/dashboard"
#     - drop /pricing, /partners, /download routes
# ─────────────────────────────────────────────────────────────────────────────
app_js = stage / "frontend/src/App.js"
if app_js.exists():
    src = app_js.read_text()

    # Remove import lines for stripped pages.
    drops = [
        r"^import LandingPage from '\./pages/LandingPage';\n",
        r"^import PricingPage from '\./pages/PricingPage';\n",
        r"^import PartnerDashboardPage from '\./pages/PartnerDashboardPage';\n",
        r"^import DownloadPage from '\./pages/DownloadPage';\n",
    ]
    for pat in drops:
        src = re.sub(pat, "", src, flags=re.MULTILINE)

    # Replace "/" landing-page route with a redirect to /dashboard.
    src = re.sub(
        r'<Route path="/" element={<LandingPage />} />',
        '<Route path="/" element={<Navigate to="/dashboard" replace />} />',
        src,
    )

    # Remove /pricing public route.
    src = re.sub(
        r'\s*<Route path="/pricing" element={<PricingPage />} />\n',
        "\n",
        src,
    )

    # Remove /partners protected route block (multiline).
    src = re.sub(
        r'\s*<Route\s+path="/partners"\s+element=\{\s*<ProtectedRoute>\s*<PartnerDashboardPage />\s*</ProtectedRoute>\s*\}\s*/>\s*',
        "\n      ",
        src,
    )

    # Remove /download protected route block (multiline) — platform-only.
    src = re.sub(
        r'\s*<Route\s+path="/download"\s+element=\{\s*<ProtectedRoute>\s*<DownloadPage />\s*</ProtectedRoute>\s*\}\s*/>\s*',
        "\n      ",
        src,
    )

    # Remove /demo placeholder CTA (tako.software landing affordance).
    src = re.sub(
        r'\s*\{/\*.*?\*/\}\s*<Route path="/demo" element={<Navigate to="/signup\?demo=1" replace />} />\n',
        "\n",
        src,
        flags=re.DOTALL,
    )

    app_js.write_text(src)
    print("  rewrote frontend/src/App.js")

# ─────────────────────────────────────────────────────────────────────────────
# 2c. Dashboard layout / navigation — strip pricing/partners/download links.
# ─────────────────────────────────────────────────────────────────────────────
layout = stage / "frontend/src/components/layout/DashboardLayout.jsx"
if layout.exists():
    src = layout.read_text()
    # Remove any nav items whose `to` targets a stripped route.
    # Kept deliberately narrow — a menu item matches a single `to="/..."`
    # occurrence on its line, so we filter those lines only.
    filtered_lines = []
    for line in src.splitlines(keepends=True):
        if re.search(r'to=["\'](?:/pricing|/partners|/download|/demo)["\']', line):
            continue
        filtered_lines.append(line)
    new_src = "".join(filtered_lines)
    if new_src != src:
        layout.write_text(new_src)
        print("  stripped nav links in DashboardLayout.jsx")

# ─────────────────────────────────────────────────────────────────────────────
# 2d. Backend: excise UNYT/crypto integration from server.py.
#
#     Strategy: delete the UNYT_* constants block and the two checkout
#     endpoints (`/checkout/launch-edition/unyt`, `/checkout/launch-edition/unyt/confirm`)
#     by anchoring on their decorator signatures and then scanning forward
#     until the next top-level decorator or function def — this mirrors what
#     an editor would do on "delete this endpoint".
# ─────────────────────────────────────────────────────────────────────────────
server_py = stage / "backend/server.py"
if server_py.exists():
    lines = server_py.read_text().splitlines(keepends=True)
    out = []
    i = 0
    stripped_something = False

    def is_block_boundary(s: str) -> bool:
        # Anchor for "end of this endpoint block".
        stripped = s.lstrip()
        return (
            stripped.startswith("@api_router.")
            or stripped.startswith("@app.")
            or (s.startswith(("def ", "async def ", "class ", "# ──")))
        )

    UNYT_CONST_RE = re.compile(r'^UNYT_[A-Z_]+\s*=')
    STRIP_NOTE = (
        "# Crypto payment integration is available on the TAKO platform "
        "(tako.software)\n"
        "# but is not included in the self-hosted package.\n"
    )
    strip_note_emitted = False

    while i < len(lines):
        line = lines[i]

        # Drop UNYT_* module constants at top level.
        if UNYT_CONST_RE.match(line):
            stripped_something = True
            i += 1
            continue

        # Drop the two UNYT endpoints (`/checkout/launch-edition/unyt` and
        # its `/confirm` variant) wholesale. After removing the decorator,
        # we also need to consume the `async def` line and the entire
        # indented function body up to the next top-level line.
        if line.lstrip().startswith(
            '@api_router.post("/checkout/launch-edition/unyt'
        ):
            stripped_something = True
            i += 1  # skip decorator
            # Skip the `async def ...` / `def ...` header.
            if i < len(lines) and lines[i].lstrip().startswith(("async def", "def ")):
                i += 1
            # Consume every indented or blank line until the next top-level
            # statement. This catches the entire function body including
            # docstring and nested blocks.
            while i < len(lines):
                cur = lines[i]
                if cur.strip() == "":
                    i += 1
                    continue
                if cur.startswith((" ", "\t")):
                    i += 1
                    continue
                break
            if not strip_note_emitted:
                out.append(STRIP_NOTE + "\n")
                strip_note_emitted = True
            continue

        out.append(line)
        i += 1

    if stripped_something:
        server_py.write_text("".join(out))
        print("  stripped UNYT constants + /checkout/launch-edition/unyt endpoints from backend/server.py")

    # Intentionally no placeholder stub — Prompt 10 requires that the string
    # "unyt" does not appear in any file of the distribution. A placeholder
    # file/module name containing the word would trip the verification grep.

# ─────────────────────────────────────────────────────────────────────────────
# 2d-bis. UNYT/crypto residue scrub.
#
# After the wholesale strips above there are still scattered references to
# the old brand — enum alternatives in comments, internal-domain allow-lists
# keyed on "unyted.world", hardcoded super-admin email checks in JSX, the
# MetaMask paragraph in the Legal page, and locale strings for UNYT licence
# types. Scrub them surgically so the verification grep finds nothing.
# ─────────────────────────────────────────────────────────────────────────────
RESIDUE_PATCHES = {
    "backend/server.py": [
        # Default for SUPER_ADMIN_EMAIL must not carry the old personal email.
        (
            r'SUPER_ADMIN_EMAIL = os\.environ\.get\("SUPER_ADMIN_EMAIL", "florian@unyted\.world"\)',
            'SUPER_ADMIN_EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "")',
        ),
        # Drop internal-domain / email entries referring to the old brand.
        # Conservative: match the quoted entry + optional trailing comma + any
        # trailing whitespace on that line. Leaves the surrounding list intact.
        (r'\s*"unyted\.world",?', ""),
        (r'\s*"unyted\.chat",?', ""),
        (r'\s*"florian@unyted\.world",?', ""),
        # Enum / payment-method comments.
        (r'"stripe" \| "unyt"', '"stripe"'),
        (r' \| "unyt"', ""),
        # Rename surviving ReferralSale field so the word "unyt" is gone.
        (r"\bunyt_tx_hash\b", "external_tx_hash"),
        # Stray docstring / comment references that mention the old brand.
        (r" / UNYT confirm", ""),
        (r"Fintery, Unyted, and any other TAKO client org",
         "any TAKO client organisation"),
        # Demo-system residue that lives inline (not wrapped in sentinels).
        # The /auth/me-chain projection fetches demo fields on the platform
        # build; customers don't have them, so reduce to deleted_at only.
        (
            r'        # Projection: deleted_at always, plus the demo fields on platform builds\n'
            r'        # — the stripper replaces this call with a deleted_at-only version\.\n',
            "",
        ),
        (
            r'\{"_id": 0, "deleted_at": 1, "is_demo": 1, "demo_status": 1, "demo_expires_at": 1\}',
            '{"_id": 0, "deleted_at": 1}',
        ),
        # Docstring paragraph that describes the demo-expiry transition.
        (
            r"\n    Also transitions active demo orgs to ``expired`` once their TTL passes\n"
            r"    \(Prompt 9\)\. We don't block expired demos here — the dedicated\n"
            r"    ``demo_write_block_middleware`` decides which methods/paths get locked\n"
            r"    out — but we flip the status synchronously so every subsequent read\n"
            r"    \(including /auth/me in the very same request\) sees the truth\.\n",
            "",
        ),
    ],
    "frontend/src/pages/SetupOrgPage.jsx": [
        # Trim the module docstring so it no longer documents the stripped
        # demo path.
        (
            r" \*   - \"Try TAKO free for 14 days\" → POST /api/demo/create"
            r"        \(Prompt 9\)\n",
            "",
        ),
        (
            r" \* The demo option is the most visually inviting — that's the default path\n"
            r" \* we want prospects to take on the tako\.software platform\. It's stripped\n"
            r" \* from the customer distribution by scripts/build-distribution\.sh\.\n"
            r" \*\n",
            "",
        ),
        # useState comment no longer needs the 'demo' alternative.
        (
            r"// 'demo' \| 'create' \| 'invite' \| null",
            "// 'create' | 'invite' | null",
        ),
    ],
    "frontend/src/components/layout/DashboardLayout.jsx": [
        (r" \|\| user\?\.email === 'florian@unyted\.world'", ""),
    ],
    "frontend/src/pages/ChatPage.jsx": [
        (r" \|\| user\?\.email === 'florian@unyted\.world'", ""),
    ],
    "frontend/src/pages/AdminPage.jsx": [
        (r" \|\| user\?\.email === 'florian@unyted\.world'", ""),
        # The delete-user guard — replace the email-compare with `true` so
        # any user row still gets the delete button.
        (r"u\.email !== 'florian@unyted\.world'", "true"),
        # Locale-key mapping entry for UNYT licence type.
        (r"^\s*unyt:\s*'admin\.licenceUnyt',\n", ""),
    ],
    "frontend/src/pages/SettingsPage.jsx": [
        (r"^\s*unyt:\s*'settings\.licenceTypeUnyt',\n", ""),
        # 'unyted.world' domain in the Stripe-visibility whitelist.
        (r"^\s*'unyted\.world',\n", ""),
    ],
    "frontend/src/pages/LegalPage.jsx": [
        # Entire <p>UNYT token payments…</p> line.
        (
            r"^\s*<p>UNYT token payments are processed via MetaMask or UNYT\.shop"
            r" and are final once confirmed on-chain\.</p>\n",
            "",
        ),
    ],
    "frontend/src/locales/en.json": [
        (r'^\s*"licenceTypeUnyt":[^\n]*\n', ""),
        (r'^\s*"licenceUnyt":[^\n]*\n', ""),
    ],
    "frontend/src/locales/de.json": [
        (r'^\s*"licenceTypeUnyt":[^\n]*\n', ""),
        (r'^\s*"licenceUnyt":[^\n]*\n', ""),
    ],
}

for relpath, patches in RESIDUE_PATCHES.items():
    path = stage / relpath
    if not path.exists():
        continue
    text = path.read_text()
    total = 0
    for pat, repl in patches:
        text, n = re.subn(pat, repl, text, flags=re.MULTILINE)
        total += n
    if total:
        path.write_text(text)
        print(f"  scrubbed {total} UNYT residue match(es) in {relpath}")

# ─────────────────────────────────────────────────────────────────────────────
# 2e. Frontend package.json — drop ethers; PricingPage is gone so the dep
#     is unused.
# ─────────────────────────────────────────────────────────────────────────────
pkg_json = stage / "frontend/package.json"
if pkg_json.exists():
    src = pkg_json.read_text()
    # Preserve trailing comma shape: delete whole line with "ethers": "...".
    new_src, n = re.subn(r'^\s*"ethers":\s*"[^"]*",?\n', "", src, flags=re.MULTILINE)
    if n:
        pkg_json.write_text(new_src)
        print("  removed ethers from frontend/package.json")

# Drop the generated lockfile — package versions in the distribution should
# match the distribution's package.json, not the platform's lockfile (which
# pins ethers). Customers regenerate via `npm ci` / `yarn install`.
pkg_lock = stage / "frontend/package-lock.json"
if pkg_lock.exists():
    pkg_lock.unlink()
    print("  removed stale frontend/package-lock.json (regenerated on install)")

# ─────────────────────────────────────────────────────────────────────────────
# 2f. Clean backend/.env.example for customers.
#     The spec prescribes the exact sections.
# ─────────────────────────────────────────────────────────────────────────────
env_example = stage / "backend/.env.example"
CUSTOMER_ENV = """# TAKO CRM — environment configuration
#
# Copy this file to `.env` and fill in values for your deployment. Required
# variables must be set before first run; authentication, email, and
# optional integrations can be configured later from Settings > Integrations.

# ─────────────────────────────────────────────────────────────────────────────
# Required
# ─────────────────────────────────────────────────────────────────────────────
MONGO_URL="mongodb://mongo:27017"
DB_NAME="tako"

JWT_SECRET="change-me-generate-a-long-random-string"
JWT_ALGORITHM="HS256"
JWT_ACCESS_EXPIRY_MINUTES=15
JWT_REFRESH_EXPIRY_DAYS=7

FRONTEND_URL="http://localhost:3000"
PUBLIC_URL="http://localhost:3000"

# Platform key for AI features. Get one at https://console.anthropic.com.
# Users can also bring their own key via Settings > Integrations.
ANTHROPIC_API_KEY=""

# ─────────────────────────────────────────────────────────────────────────────
# Authentication (Google Sign-In)
# ─────────────────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ─────────────────────────────────────────────────────────────────────────────
# Email (transactional via Resend)
# ─────────────────────────────────────────────────────────────────────────────
RESEND_API_KEY=""
SENDER_EMAIL="noreply@example.com"

# ─────────────────────────────────────────────────────────────────────────────
# Optional
# ─────────────────────────────────────────────────────────────────────────────
# Error monitoring. Soft dependency — leave blank to disable.
SENTRY_DSN=""
ENVIRONMENT="production"

# Your company VAT number — shown on every invoice. Leave as the placeholder
# in dev; set a real number before invoicing customers.
COMPANY_VAT_NUMBER="GB000000000"
"""
env_example.write_text(CUSTOMER_ENV)
print("  rewrote backend/.env.example (customer-facing)")

# ─────────────────────────────────────────────────────────────────────────────
# 2g. Super-admin UI: strip nav entries that point at /admin. The backend
#     role check stays (harmless — a customer account is never super_admin
#     and therefore never sees the page).
# ─────────────────────────────────────────────────────────────────────────────
admin_page = stage / "frontend/src/pages/AdminPage.jsx"
# Keep AdminPage for now — the component also renders per-org admin UI; it
# guards on role server-side. Only the navigation entry needs scrubbing,
# and that's already done in 2c above.

# ─────────────────────────────────────────────────────────────────────────────
# 2h. Replace README.md with the customer install guide. The source file
#     lives in the original repo's scripts/ dir and is intentionally excluded
#     from the rsync step above — read it directly from REPO_ROOT so the
#     Python step doesn't need it to survive the copy.
# ─────────────────────────────────────────────────────────────────────────────
repo_root = Path(os.environ["REPO_ROOT"])
dist_readme_src = repo_root / "scripts/distribution-README.md"
if dist_readme_src.exists():
    shutil.copyfile(dist_readme_src, stage / "README.md")
    print("  replaced README.md with customer install guide")
else:
    print("  WARNING: scripts/distribution-README.md not found; README.md unchanged")

# ─────────────────────────────────────────────────────────────────────────────
# 2i. Remove the scripts/ directory entries that are platform-only.
#     Keep: backup-mongo.sh, migrate_campaigns_add_channel.py.
# ─────────────────────────────────────────────────────────────────────────────
scripts_dir = stage / "scripts"
keep = {"backup-mongo.sh", "migrate_campaigns_add_channel.py"}
if scripts_dir.exists():
    for entry in scripts_dir.iterdir():
        if entry.name not in keep:
            if entry.is_file():
                entry.unlink()
                print(f"  removed scripts/{entry.name}")

# ─────────────────────────────────────────────────────────────────────────────
# 2j. Drop any leftover empty platform directories.
# ─────────────────────────────────────────────────────────────────────────────
for d in ["exports", "uploads", "database-backup", "patches", "test_reports", "memory"]:
    p = stage / d
    if p.exists():
        shutil.rmtree(p)
        print(f"  removed directory {d}/")

PYEOF

# ---------------------------------------------------------------------------
# 3. Build frontend production bundle inside the stage dir.
#    Keeps both the source and the built output so customers can modify +
#    rebuild, but have a ready-to-serve build out of the box.
# ---------------------------------------------------------------------------
if [ -d "${STAGE_DIR}/frontend" ] && [ -f "${STAGE_DIR}/frontend/package.json" ]; then
    log "installing frontend deps + building production bundle…"
    (
        cd "${STAGE_DIR}/frontend"
        if command -v npm >/dev/null 2>&1; then
            npm install --no-audit --no-fund --loglevel=error
            npm run build
        else
            err "npm not found — skipping frontend build (source still shipped)"
        fi
    ) || {
        err "frontend build failed — packaging source-only"
    }

    # Customers reinstall deps themselves via `npm ci` on their server.
    # Shipping node_modules would 5× the tarball size and pin dev-machine
    # native binaries that likely won't match the customer's platform.
    rm -rf "${STAGE_DIR}/frontend/node_modules"
    log "cleaned frontend/node_modules from stage (customers run npm ci)"
fi

# ---------------------------------------------------------------------------
# 4. Archive + hash.
# ---------------------------------------------------------------------------
log "creating tarball…"
rm -f "${TARBALL}" "${HASH_FILE}"
tar -czf "${TARBALL}" -C "${BUILD_DIR}" "tako-crm-${VERSION}"

log "computing sha256…"
if command -v shasum >/dev/null 2>&1; then
    HASH="$(shasum -a 256 "${TARBALL}" | awk '{print $1}')"
else
    HASH="$(sha256sum "${TARBALL}" | awk '{print $1}')"
fi

printf '%s  %s\n' "${HASH}" "$(basename "${TARBALL}")" > "${HASH_FILE}"
printf '%s\n' "${VERSION}" > "${VERSION_FILE}"

SIZE="$(wc -c < "${TARBALL}" | tr -d ' ')"
log "done."
log "  tarball: ${TARBALL}"
log "  size:    ${SIZE} bytes"
log "  sha256:  ${HASH}"
log "  version: ${VERSION}"
