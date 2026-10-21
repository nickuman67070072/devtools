$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

if (-not (docker container inspect devtools 2>$null)) {
  throw 'Container devtools was not found. Create it with the command in README first.'
}

docker exec devtools docker compose --env-file /workspace/.env -f /workspace/infra/compose.yml up -d postgres mailpit
$existing = docker exec devtools docker ps -aq --filter 'name=^/pawmap-dev$'
if ($existing) {
  docker exec devtools docker rm -f pawmap-dev | Out-Null
}

docker exec devtools docker run -d --name pawmap-dev --network pawmap-local_default -p 3000:3000 `
  --env-file /workspace/.env `
  -v /workspace:/workspace -v pawmap-dev-node-modules:/workspace/node_modules -w /workspace `
  --entrypoint sh tuchsanai/devtools:2569_1 `
  -lc 'export DATABASE_URL="$CONTAINER_DATABASE_URL" S3_ENDPOINT="$CONTAINER_S3_ENDPOINT"; npm ci && npx prisma migrate deploy && npm run db:seed && npm run dev'

Write-Host "PawMap development is starting from $workspace - open http://localhost:3000"
