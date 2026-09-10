#!/usr/bin/env bash
# Brings up disposable staging Postgres + Redis, proves the targets, applies
# migrations through the guarded wrapper, and runs the smoke test. The smoke
# test itself is NOT modified by this script — it stays the source of truth and
# is invoked exactly as docs/34 §3 documents.
#
#   ./infra/staging/run-smoke.sh [--skip-ocr] [--only NAME]
#
# Arguments are passed straight through to scripts/staging_provider_smoke.py.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/infra/staging/staging.env"
COMPOSE_FILE="$REPO_ROOT/infra/staging/docker-compose.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  echo "  cp infra/staging/staging.env.example infra/staging/staging.env" >&2
  echo "  then fill in OPENAI_API_KEY and SMOKE_OCR_IMAGE_URL." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

# Fail closed on every target and secret. DIRECT_URL is in this list because
# Prisma migrations resolve directUrl, not url — a run with DATABASE_URL alone
# would migrate the shared database, and would do it silently.
for required in AIOS_ENV NODE_ENV DATABASE_URL DIRECT_URL REDIS_URL \
                STAGING_DB_ALLOWLIST STAGING_REDIS_ALLOWLIST OPENAI_API_KEY; do
  if [ -z "${!required:-}" ]; then
    echo "$required is empty in $ENV_FILE — refusing to continue." >&2
    exit 1
  fi
done

echo "==> Starting disposable Postgres + Redis (loopback only, RAM-backed)"
docker compose -f "$COMPOSE_FILE" up -d --wait

echo
echo "==> Proving the targets before touching them"
node "$REPO_ROOT/infra/staging/prove-targets.js"

echo
echo "==> Applying migrations to the staging database"
# NOT `prisma migrate deploy`. That command resolves DIRECT_URL, which
# packages/db/.env points at the shared Supabase instance — so the obvious
# invocation migrates the wrong database and says nothing about it. This wrapper
# asks Prisma which datasource it ACTUALLY resolved and refuses unless it is a
# nominated staging host. It also applies committed migrations only: it never
# generates new ones and never prompts, so it cannot drift the schema the way
# `migrate dev` can.
node "$REPO_ROOT/infra/staging/migrate-staging.js"

echo
echo "==> Generating Prisma clients (the Python client comes from the Node CLI)"
(cd "$REPO_ROOT" && pnpm db:generate)

echo
echo "==> Running the smoke test (unmodified)"
cd "$REPO_ROOT/apps/api-python"
python scripts/staging_provider_smoke.py "$@"
status=$?

echo
echo "==> Verifying isolation after the run"
node "$REPO_ROOT/infra/staging/verify-isolation.js" || echo "    (isolation verification reported failures — see above)"

echo
echo "==> Done (exit $status). Tear down with:"
echo "    docker compose -f infra/staging/docker-compose.yml down"
echo "    (Postgres and Redis are RAM-backed, so stopping the containers discards all data)"
exit $status
