#!/bin/sh
set -eu

APP_IMAGE="${1:?app image is required}"
MIGRATOR_IMAGE="${2:?migrator image is required}"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/compose.yml"
NGINX_DIR="$ROOT_DIR/infra/nginx"
NGINX_VOLUME="pawmap-nginx-config"
BACKUP_DIR="$ROOT_DIR/infra/backups"
LOG_DIR="$ROOT_DIR/infra/deploy-logs"
READINESS_ATTEMPTS="${PAWMAP_READINESS_ATTEMPTS:-30}"
READINESS_INTERVAL_SECONDS="${PAWMAP_READINESS_INTERVAL_SECONDS:-2}"
RUNTIME_ENV_FILE="${PAWMAP_RUNTIME_ENV_FILE:?PAWMAP_RUNTIME_ENV_FILE is required}"
[ -f "$RUNTIME_ENV_FILE" ] || { printf 'Runtime environment file not found: %s\n' "$RUNTIME_ENV_FILE" >&2; exit 1; }
DEPLOY_TOKEN="$(date +%s)-$$"
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

compose() {
  docker compose --env-file "$RUNTIME_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

release_from_headers() {
  sed -n 's/^[Xx]-[Pp]aw[Mm]ap-[Rr]elease:[[:space:]]*//p' "$1" | tr -d '\r' | head -n 1
}

write_upstream() {
  slot="$1"
  docker run --rm -e SLOT="$slot" -v "$NGINX_VOLUME:/config" --entrypoint sh nginx:1.28-bookworm -c 'printf "upstream pawmap_active {\n  server app-%s:3000;\n  keepalive 32;\n}\n" "$SLOT" > /config/active-upstream.conf.next; mv /config/active-upstream.conf.next /config/active-upstream.conf'
}

docker volume create --label pawmap.project=pawmap-local "$NGINX_VOLUME" >/dev/null
compose up -d postgres mailpit
docker run --rm -v "$NGINX_VOLUME:/target" -v "$NGINX_DIR:/source:ro" --entrypoint sh nginx:1.28-bookworm -c 'cp /source/app.conf /target/app.conf; if [ ! -f /target/active-upstream.conf ]; then cp /source/active-upstream.conf /target/active-upstream.conf; fi'
if docker run --rm -v "$NGINX_VOLUME:/config:ro" --entrypoint sh nginx:1.28-bookworm -c 'cat /config/active-upstream.conf' | grep -q 'app-blue'; then OLD_SLOT=blue; NEW_SLOT=green; else OLD_SLOT=green; NEW_SLOT=blue; fi
OLD_CONTAINER="pawmap-app-$OLD_SLOT"
NEW_CONTAINER="pawmap-app-$NEW_SLOT"
OLD_WORKER="pawmap-meetup-worker-$OLD_SLOT"
NEW_WORKER="pawmap-meetup-worker-$NEW_SLOT"
NETWORK="pawmap-local_default"
OLD_EXISTS=0
if docker container inspect "$OLD_CONTAINER" >/dev/null 2>&1; then OLD_EXISTS=1; fi

compose exec -T postgres pg_dump -U "${POSTGRES_USER:-pawmap}" -d pawmap -Fc > "$BACKUP_DIR/predeploy-$(date +%Y%m%d-%H%M%S).dump"
docker run --rm --network "$NETWORK" --env-file "$RUNTIME_ENV_FILE" "$MIGRATOR_IMAGE"

if docker container inspect "$NEW_CONTAINER" >/dev/null 2>&1; then docker rm -f "$NEW_CONTAINER"; fi
docker run -d --name "$NEW_CONTAINER" --network "$NETWORK" --network-alias "app-$NEW_SLOT" \
  --label pawmap.project=pawmap-local --label "pawmap.slot=$NEW_SLOT" \
  --env-file "$RUNTIME_ENV_FILE" \
  -e PAWMAP_RELEASE="$DEPLOY_TOKEN" \
  "$APP_IMAGE" > "$LOG_DIR/container-$NEW_SLOT.log"

READY=0
CANDIDATE_RELEASE=""
for attempt in $(seq 1 "$READINESS_ATTEMPTS"); do
  if docker run --rm --network "$NETWORK" --entrypoint sh tuchsanai/devtools:2569_1 -lc "curl -fsS -D - -o /dev/null http://app-$NEW_SLOT:3000/api/health/ready" > "$LOG_DIR/candidate-headers-$NEW_SLOT.log" 2>&1; then
    CANDIDATE_RELEASE="$(release_from_headers "$LOG_DIR/candidate-headers-$NEW_SLOT.log")"
    if [ -n "$CANDIDATE_RELEASE" ]; then READY=1; break; fi
  fi
  sleep "$READINESS_INTERVAL_SECONDS"
done
if [ "$READY" -ne 1 ]; then
  docker logs "$NEW_CONTAINER" > "$LOG_DIR/readiness-failed-$NEW_SLOT.log" 2>&1 || true
  docker rm -f "$NEW_CONTAINER"
  printf 'Candidate %s failed readiness; active slot %s was not changed.\n' "$NEW_SLOT" "$OLD_SLOT" > "$LOG_DIR/deploy-failed-$NEW_SLOT.log"
  exit 1
fi

write_upstream "$NEW_SLOT"
SWITCH_OK=1
SWITCH_LOG="$LOG_DIR/nginx-switch-$NEW_SLOT.log"
if ! compose up -d --no-deps nginx > "$SWITCH_LOG" 2>&1; then SWITCH_OK=0; fi
if [ "$SWITCH_OK" -eq 1 ] && ! compose exec -T nginx nginx -t >> "$SWITCH_LOG" 2>&1; then SWITCH_OK=0; fi
if [ "$SWITCH_OK" -eq 1 ] && ! compose exec -T nginx nginx -s reload >> "$SWITCH_LOG" 2>&1; then SWITCH_OK=0; fi
if [ "$SWITCH_OK" -eq 1 ]; then
  SWITCH_OK=0
  for attempt in $(seq 1 10); do
    if compose exec -T nginx curl -fsS -D - http://127.0.0.1:3000/api/health/ready > "$LOG_DIR/nginx-smoke-$NEW_SLOT.http" 2>> "$SWITCH_LOG"; then
      observed_release="$(release_from_headers "$LOG_DIR/nginx-smoke-$NEW_SLOT.http")"
      if [ "$observed_release" = "$CANDIDATE_RELEASE" ]; then SWITCH_OK=1; break; fi
      printf 'Nginx served release %s while candidate is %s.\n' "$observed_release" "$CANDIDATE_RELEASE" >> "$SWITCH_LOG"
    fi
    sleep 1
  done
fi

if [ "$SWITCH_OK" -ne 1 ]; then
  if [ "$OLD_EXISTS" -eq 1 ]; then
    write_upstream "$OLD_SLOT"
    ROLLBACK_OK=1
    ROLLBACK_LOG="$LOG_DIR/nginx-rollback-$OLD_SLOT.log"
    if ! compose up -d --no-deps nginx > "$ROLLBACK_LOG" 2>&1; then ROLLBACK_OK=0; fi
    if [ "$ROLLBACK_OK" -eq 1 ] && ! compose exec -T nginx nginx -t >> "$ROLLBACK_LOG" 2>&1; then ROLLBACK_OK=0; fi
    if [ "$ROLLBACK_OK" -eq 1 ] && ! compose exec -T nginx nginx -s reload >> "$ROLLBACK_LOG" 2>&1; then ROLLBACK_OK=0; fi
    if [ "$ROLLBACK_OK" -eq 1 ] && compose exec -T nginx curl -fsS http://127.0.0.1:3000/api/health/ready > "$LOG_DIR/nginx-rollback-smoke-$OLD_SLOT.json" 2>> "$ROLLBACK_LOG"; then
      docker rm -f "$NEW_CONTAINER"
      printf 'Candidate %s failed Nginx smoke; restored %s.\n' "$NEW_SLOT" "$OLD_SLOT" >> "$ROLLBACK_LOG"
    else
      printf 'Rollback to %s also failed; both application slots were retained for diagnosis.\n' "$OLD_SLOT" >> "$ROLLBACK_LOG"
    fi
  else
    printf 'Candidate %s failed Nginx smoke and no previous slot exists; candidate retained for diagnosis.\n' "$NEW_SLOT" > "$LOG_DIR/nginx-no-rollback-$NEW_SLOT.log"
  fi
  exit 1
fi

if docker container inspect "$NEW_WORKER" >/dev/null 2>&1; then docker rm -f "$NEW_WORKER"; fi
WORKER_STARTED=0
if docker run -d --name "$NEW_WORKER" --network "$NETWORK" \
  --label pawmap.project=pawmap-local --label "pawmap.slot=$NEW_SLOT" \
  --env-file "$RUNTIME_ENV_FILE" \
  --entrypoint node "$APP_IMAGE" workers/meetup-worker.mjs > "$LOG_DIR/worker-$NEW_SLOT.log" 2>&1; then WORKER_STARTED=1; fi
sleep 2
if [ "$WORKER_STARTED" -ne 1 ] || [ "$(docker inspect -f '{{.State.Running}}' "$NEW_WORKER" 2>/dev/null || true)" != true ]; then
  cp "$LOG_DIR/worker-$NEW_SLOT.log" "$LOG_DIR/worker-failed-$NEW_SLOT.log"
  docker logs "$NEW_WORKER" >> "$LOG_DIR/worker-failed-$NEW_SLOT.log" 2>&1 || true
  if [ "$OLD_EXISTS" -eq 1 ]; then
    write_upstream "$OLD_SLOT"
    ROLLBACK_OK=1
    if ! compose exec -T nginx nginx -t >> "$LOG_DIR/worker-failed-$NEW_SLOT.log" 2>&1; then ROLLBACK_OK=0; fi
    if [ "$ROLLBACK_OK" -eq 1 ] && ! compose exec -T nginx nginx -s reload >> "$LOG_DIR/worker-failed-$NEW_SLOT.log" 2>&1; then ROLLBACK_OK=0; fi
    if [ "$ROLLBACK_OK" -eq 1 ] && compose exec -T nginx curl -fsS http://127.0.0.1:3000/api/health/ready >> "$LOG_DIR/worker-failed-$NEW_SLOT.log" 2>&1; then
      docker rm -f "$NEW_CONTAINER" "$NEW_WORKER" >/dev/null 2>&1 || true
    else
      printf 'Worker rollback failed; candidate retained for diagnosis.\n' >> "$LOG_DIR/worker-failed-$NEW_SLOT.log"
    fi
  fi
  printf 'Meetup worker failed; deployment was not accepted.\n' >> "$LOG_DIR/worker-failed-$NEW_SLOT.log"
  exit 1
fi
if docker container inspect "$OLD_WORKER" >/dev/null 2>&1; then docker rm -f "$OLD_WORKER"; fi

if docker container inspect "$OLD_CONTAINER" >/dev/null 2>&1; then
  docker rm -f "$OLD_CONTAINER"
  printf 'Deployed %s to %s; previous slot %s removed after smoke test.\n' "$APP_IMAGE" "$NEW_SLOT" "$OLD_SLOT"
else
  printf 'Deployed %s to %s; this was the first healthy slot.\n' "$APP_IMAGE" "$NEW_SLOT"
fi
