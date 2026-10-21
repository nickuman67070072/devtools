#!/bin/sh
set -eu

: "${JENKINS_ADMIN_ID:?Jenkins admin ID is required}"
: "${JENKINS_ADMIN_PASSWORD:?Jenkins admin password is required}"

base='http://127.0.0.1:8080'
cookie_jar=$(mktemp /tmp/pawmap-jenkins-cookies.XXXXXX)
trap 'rm -f "$cookie_jar"' EXIT
crumb=$(curl -fsS -c "$cookie_jar" -b "$cookie_jar" \
  --user "$JENKINS_ADMIN_ID:$JENKINS_ADMIN_PASSWORD" \
  "$base/crumbIssuer/api/json" | sed -n 's/.*"crumb":"\([^"]*\)".*/\1/p')
[ -n "$crumb" ] || { echo 'Jenkins did not return a CSRF crumb' >&2; exit 1; }
curl -fsS -o /dev/null -w 'Jenkins trigger HTTP %{http_code}\n' \
  -b "$cookie_jar" \
  --user "$JENKINS_ADMIN_ID:$JENKINS_ADMIN_PASSWORD" \
  -H "Jenkins-Crumb: $crumb" \
  --data-urlencode "BRANCH=${1:-main}" \
  "$base/job/pawmap-local/buildWithParameters"
