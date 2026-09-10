#!/usr/bin/env bash
# The only supported way to start a staging process.
#
#   ./infra/staging/run-stack.sh api      # Nest HTTP API (no workers)
#   ./infra/staging/run-stack.sh worker   # BullMQ workers (no HTTP listener)
#   ./infra/staging/run-stack.sh python   # FastAPI AI service
#   ./infra/staging/run-stack.sh prove    # target proof only, start nothing
#
# WHY THIS EXISTS: staging used to be a launch procedure you had to remember —
# pass DATABASE_URL, and DIRECT_URL, and REDIS_URL, on every command, every time.
# Forget one and the process came up attached to shared infrastructure, looking
# completely normal. There is now exactly one command per process, it takes its
# configuration from exactly one file, and the process itself refuses to boot if
# that did not take effect (AIOS_ENV=staging arms the guard in
# apps/api/src/config/env.schema.ts and apps/api-python/src/config.py).
#
# Everything not in staging.env — Google OAuth client, S3, Sentry — still comes
# from the app's own .env, which is left untouched. staging.env supplies the
# targets and the staging secrets, and overrides those files because process env
# wins. The boot guard is what proves the override actually happened.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/infra/staging/staging.env"

usage() {
  echo "usage: $0 <api|worker|python|prove>" >&2
  exit 64
}

[ $# -eq 1 ] || usage
TARGET="$1"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  echo "  cp infra/staging/staging.env.example infra/staging/staging.env" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

# Fail closed on every target. These are never defaulted: a staging process that
# was not told where to point must stop, not fall back.
for required in AIOS_ENV NODE_ENV DATABASE_URL DIRECT_URL REDIS_URL STAGING_DB_ALLOWLIST STAGING_REDIS_ALLOWLIST; do
  if [ -z "${!required:-}" ]; then
    echo "$required is empty in $ENV_FILE — refusing to continue." >&2
    exit 1
  fi
done

# Layer 1: prove the targets are safe, live, and what they claim to be, before
# starting anything that could write to them.
node "$REPO_ROOT/infra/staging/prove-targets.js"
[ "$TARGET" = "prove" ] && exit 0

echo
case "$TARGET" in
  api)
    # Workers run as their own process (apps/api/src/worker.ts). An API that also
    # consumed queues would share one event loop with user requests.
    export RUN_WORKERS=false
    cd "$REPO_ROOT/apps/api"
    [ -f dist/main.js ] || { echo "dist/main.js missing — run: pnpm --filter @aios/api build" >&2; exit 1; }
    echo "==> staging API (workers off) — boot guard armed by AIOS_ENV=staging"
    exec node dist/main.js
    ;;
  worker)
    cd "$REPO_ROOT/apps/api"
    [ -f dist/worker.js ] || { echo "dist/worker.js missing — run: pnpm --filter @aios/api build" >&2; exit 1; }
    echo "==> staging worker — boot guard armed by AIOS_ENV=staging"
    exec node dist/worker.js
    ;;
  python)
    cd "$REPO_ROOT/apps/api-python"
    echo "==> staging Python AI service — boot guard armed by AIOS_ENV=staging"
    exec python -m uvicorn src.main:app --host 127.0.0.1 --port 8000
    ;;
  *)
    usage
    ;;
esac
