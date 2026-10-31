#!/usr/bin/env bash
set -euo pipefail

# AIOS / SARVLEKH — Production Automated Database Backup Runner
# 
# This script executes logical backups without exposing database credentials in
# crontab schedules, syslog, or system process tables (ps aux).
#
# Usage via crontab:
#   0 2 * * * /home/ubuntu/sarvlekh/aios/infra/backup/run-backup.sh >> /var/log/aios-backup.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env.production"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/aios}"

echo "=========================================================="
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting AIOS Scheduled Backup"
echo "=========================================================="

if [ ! -f "${ENV_FILE}" ]; then
  echo "[-] ERROR: Production environment file not found at ${ENV_FILE}" >&2
  exit 1
fi

# Extract DIRECT_URL safely from .env.production without printing secrets
DIRECT_URL="$(grep -E '^DIRECT_URL=' "${ENV_FILE}" | head -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")"

if [ -z "${DIRECT_URL}" ]; then
  echo "[-] ERROR: DIRECT_URL is not configured in ${ENV_FILE}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

# Execute verified logical backup (custom format -Fc with sha256 checksum & pg_restore --list verification)
cd "${REPO_ROOT}"
node "${SCRIPT_DIR}/backup.js" --url "${DIRECT_URL}" --out "${BACKUP_DIR}"

echo "[+] Local logical backup completed successfully."

# Off-site S3 replication (Optional, active when BACKUP_S3_BUCKET is configured)
BACKUP_S3_BUCKET="$(grep -E '^BACKUP_S3_BUCKET=' "${ENV_FILE}" | head -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)"

if [ -n "${BACKUP_S3_BUCKET}" ]; then
  echo "[+] Replicating backups off-site to s3://${BACKUP_S3_BUCKET}/database-backups/..."
  if command -v aws >/dev/null 2>&1; then
    aws s3 sync "${BACKUP_DIR}" "s3://${BACKUP_S3_BUCKET}/database-backups/" --sse AES256 --delete
    echo "[+] Off-site S3 replication complete."
  else
    echo "[-] WARNING: AWS CLI not installed on host. Off-site S3 replication skipped." >&2
  fi
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup workflow finished cleanly."

