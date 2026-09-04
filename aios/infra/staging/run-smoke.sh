#!/usr/bin/env bash
# Brings up disposable staging Postgres, applies migrations, and runs the smoke
# test. The smoke test itself is NOT modified by this script — it stays the
# source of truth and is invoked exactly as docs/34 §3 documents.
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

for required in AIOS_ENV DATABASE_URL STAGING_DB_ALLOWLIST OPENAI_API_KEY; do
  if [ -z "${!required:-}" ]; then
    echo "$required is empty in $ENV_FILE — refusing to continue." >&2
    exit 1
  fi
done

echo "==> Starting disposable Postgres (loopback only, RAM-backed)"
docker compose -f "$COMPOSE_FILE" up -d --wait

echo "==> Applying migrations to the staging database"
# migrate deploy applies committed migrations only; it never generates new ones
# and never prompts, so it cannot drift the schema the way `migrate dev` can.
(cd "$REPO_ROOT" && pnpm --filter @aios/db exec prisma migrate deploy)

echo "==> Generating Prisma clients (the Python client comes from the Node CLI)"
(cd "$REPO_ROOT" && pnpm db:generate)

echo "==> Running the smoke test (unmodified)"
cd "$REPO_ROOT/apps/api-python"
python scripts/staging_provider_smoke.py "$@"
status=$?

echo
echo "==> Done (exit $status). Tear down with:"
echo "    docker compose -f infra/staging/docker-compose.yml down"
echo "    (the database is RAM-backed, so stopping the container discards all data)"
exit $status
