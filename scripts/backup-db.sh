#!/usr/bin/env bash
#
# Nightly Postgres backup for the single-VPS deployment.
#
# Install (on the VPS, as the user that owns the compose project):
#   crontab -e
#   15 3 * * * cd /srv/all-about-saas && ./scripts/backup-db.sh >> /var/log/aas-backup.log 2>&1
#
# A backup you have never restored is a hypothesis, not a backup. Test it:
#   ./scripts/backup-db.sh --verify-latest
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

mkdir -p "$BACKUP_DIR"

# --- verify mode: restore the newest dump into a scratch database ------------
# This is the only way to know the dumps are usable. It never touches the live
# database: it creates, restores into, and drops a throwaway one.
if [[ "${1:-}" == "--verify-latest" ]]; then
	latest="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
	[[ -n "$latest" ]] || { echo "No dump found in $BACKUP_DIR"; exit 1; }
	scratch="verify_$(date +%s)"
	echo "Restoring $latest into scratch DB $scratch"
	compose exec -T postgres createdb -U "$DATABASE_USER" "$scratch"
	# pg_restore exits non-zero on harmless notices, so failure is judged by the
	# table count below rather than by its exit code alone.
	compose exec -T postgres pg_restore -U "$DATABASE_USER" -d "$scratch" --no-owner \
		< "$latest" || echo "pg_restore reported warnings; checking result"
	tables="$(compose exec -T postgres psql -U "$DATABASE_USER" -d "$scratch" -tAc \
		"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
	compose exec -T postgres dropdb -U "$DATABASE_USER" "$scratch"
	echo "Restored object count: $tables"
	[[ "${tables//[[:space:]]/}" -gt 0 ]] || { echo "RESTORE PRODUCED NO TABLES"; exit 1; }
	echo "Restore verified."
	exit 0
fi

# --- backup ------------------------------------------------------------------
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/${DATABASE_NAME}-${stamp}.dump"

# -Fc = custom format: compressed, and restorable table-by-table with pg_restore.
compose exec -T postgres pg_dump -U "$DATABASE_USER" -d "$DATABASE_NAME" -Fc > "$out"

# An empty or truncated dump is worse than no dump, because it looks like one.
size="$(wc -c < "$out")"
[[ "$size" -gt 1024 ]] || { echo "Dump suspiciously small ($size bytes) — failing"; rm -f "$out"; exit 1; }
echo "Wrote $out ($size bytes)"

find "$BACKUP_DIR" -name '*.dump' -type f -mtime "+$KEEP_DAYS" -delete

# --- offsite -----------------------------------------------------------------
# REQUIRED for this to be a real backup. A dump on the same disk as the database
# does not survive the failure it exists for. Uncomment and configure one:
#
#   aws s3 cp "$out" "s3://$BACKUP_BUCKET/postgres/" --storage-class STANDARD_IA
#   rclone copy "$out" "b2:$BACKUP_BUCKET/postgres/"
#   restic -r "$RESTIC_REPO" backup "$out"
#
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
	echo "Uploading to $BACKUP_REMOTE"
	rclone copy "$out" "$BACKUP_REMOTE"
else
	echo "WARNING: BACKUP_REMOTE is unset — this backup is local-only and will not survive a disk failure."
fi
