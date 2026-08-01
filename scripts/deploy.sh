#!/usr/bin/env bash
#
# Deploy one image tag on the VPS. Runs ON the server, invoked over SSH by
# .github/workflows/cd.yml — or by hand:
#
#   cd /srv/all-about-saas && IMAGE_TAG=<sha> ./scripts/deploy.sh
#
# Rollback is the same command with an older tag; every deploy leaves the
# previous tag recorded in .last-deployed-tag.
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
TAG_FILE=".last-deployed-tag"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

: "${IMAGE_TAG:?IMAGE_TAG is required (a commit SHA, or 'latest')}"

compose() {
	IMAGE_TAG="$IMAGE_TAG" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

log() { printf '\n=== %s\n' "$*"; }

# The tag currently serving, captured BEFORE anything changes — this is what a
# rollback returns to. Empty on the very first deploy.
PREVIOUS_TAG="$(cat "$TAG_FILE" 2>/dev/null || true)"

log "Deploying $IMAGE_TAG (previous: ${PREVIOUS_TAG:-none})"

# --- pull -------------------------------------------------------------------
# Before touching the running stack: if the registry does not have this tag, or
# credentials expired, fail here while the old version is still serving.
log "Pulling images"
compose pull api web

# --- migrate ----------------------------------------------------------------
# One-shot, before the new api starts. `up` (not `run`) so the service's
# depends_on/service_healthy gate on postgres applies.
#
# NOT rolled back automatically on a later failure: an expand/contract migration
# is designed to be compatible with the previous app version, and blindly
# reverting one that already committed can destroy data the old code cannot
# restore. If the health check below fails, the app rolls back and the schema
# stays forward — which is the safe direction.
log "Running migrations"
compose up --no-deps --exit-code-from migrate migrate

# --- swap -------------------------------------------------------------------
log "Starting api and web"
compose up -d --no-deps api web

# --- verify -----------------------------------------------------------------
# Compose healthchecks are the source of truth here: the api's probe is
# /health/ready, which fails when the database is unreachable, so "healthy"
# means genuinely serving rather than merely started.
log "Waiting for health (timeout ${HEALTH_TIMEOUT}s)"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
healthy=false
while [ "$(date +%s)" -lt "$deadline" ]; do
	api_state="$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)" 2>/dev/null || echo starting)"
	web_state="$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q web)" 2>/dev/null || echo starting)"
	if [ "$api_state" = healthy ] && [ "$web_state" = healthy ]; then
		healthy=true
		break
	fi
	if [ "$api_state" = unhealthy ] || [ "$web_state" = unhealthy ]; then
		break
	fi
	sleep 3
done

if [ "$healthy" != true ]; then
	log "UNHEALTHY (api=$api_state web=$web_state)"
	compose logs --tail 60 api web || true

	if [ "${SKIP_ROLLBACK:-0}" = 1 ]; then
		# We ARE the rollback attempt and it just failed too. Stop here.
		# Without this guard the recursion never ends: the tag file still holds
		# the old tag (it is only written on success), so a rollback that fails
		# would read its own tag as "previous" and re-invoke itself forever.
		log "Rollback attempt is itself unhealthy — manual intervention required"
		exit 1
	fi

	if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$IMAGE_TAG" ]; then
		log "Rolling back to $PREVIOUS_TAG"
		# Re-exec rather than duplicating the swap: the rollback path is then the
		# same code as the deploy path, so it cannot rot from disuse.
		SKIP_ROLLBACK=1 IMAGE_TAG="$PREVIOUS_TAG" "$0" ||
			log "ROLLBACK FAILED — manual intervention required"
	else
		log "No distinct previous tag recorded; nothing to roll back to."
	fi
	exit 1
fi

echo "$IMAGE_TAG" > "$TAG_FILE"
log "Deployed $IMAGE_TAG — api and web healthy"

# Old image layers accumulate on a small VPS disk faster than anyone expects.
# Prune only dangling ones, so the previous tag survives for rollback.
docker image prune -f >/dev/null 2>&1 || true
