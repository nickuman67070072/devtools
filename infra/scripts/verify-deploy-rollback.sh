#!/bin/sh
set -eu

MIGRATOR_IMAGE="${1:?migrator image is required}"
VERIFY_TAG="${2:?verification tag is required}"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/compose.yml"
RUNTIME_ENV_FILE="${PAWMAP_RUNTIME_ENV_FILE:?PAWMAP_RUNTIME_ENV_FILE is required}"
[ -f "$RUNTIME_ENV_FILE" ] || { printf 'Runtime environment file not found: %s\n' "$RUNTIME_ENV_FILE" >&2; exit 1; }
compose() {
  docker compose --env-file "$RUNTIME_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}
DEPLOY_SCRIPT="$ROOT_DIR/infra/scripts/deploy-local.sh"
FIXTURE_IMAGE="pawmap-deploy-smoke-failure:$VERIFY_TAG"

active_slot() {
  if compose exec -T nginx cat /etc/nginx/conf.d/active-upstream.conf | grep -q 'app-blue'; then
    printf 'blue'
  else
    printf 'green'
  fi
}

assert_active_slot() {
  expected="$1"
  actual="$(active_slot)"
  other=blue
  if [ "$expected" = blue ]; then other=green; fi

  if [ "$actual" != "$expected" ]; then
    printf 'Expected active slot %s, found %s.\n' "$expected" "$actual" >&2
    return 1
  fi
  docker container inspect "pawmap-app-$expected" >/dev/null
  if docker container inspect "pawmap-app-$other" >/dev/null 2>&1; then
    printf 'Failed candidate pawmap-app-%s was retained.\n' "$other" >&2
    return 1
  fi
  compose exec -T nginx curl -fsS http://127.0.0.1:3000/api/health/ready >/dev/null
}

cleanup() {
  docker image rm "$FIXTURE_IMAGE" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

ORIGINAL_SLOT="$(active_slot)"
assert_active_slot "$ORIGINAL_SLOT"

if PAWMAP_READINESS_ATTEMPTS=2 PAWMAP_READINESS_INTERVAL_SECONDS=1 sh "$DEPLOY_SCRIPT" nginx:1.28-bookworm "$MIGRATOR_IMAGE"; then
  printf 'A candidate without a readiness endpoint was accepted unexpectedly.\n' >&2
  exit 1
fi
assert_active_slot "$ORIGINAL_SLOT"
printf 'Readiness failure preserved active slot %s.\n' "$ORIGINAL_SLOT"

docker build -f "$ROOT_DIR/infra/test/Dockerfile.smoke-failure" -t "$FIXTURE_IMAGE" "$ROOT_DIR"
if sh "$DEPLOY_SCRIPT" "$FIXTURE_IMAGE" "$MIGRATOR_IMAGE"; then
  printf 'A candidate that fails through Nginx was accepted unexpectedly.\n' >&2
  exit 1
fi
assert_active_slot "$ORIGINAL_SLOT"
printf 'Nginx smoke failure rolled back to active slot %s.\n' "$ORIGINAL_SLOT"
