$ErrorActionPreference = 'Stop'
if (docker exec devtools docker container inspect pawmap-dev 2>$null) {
  docker exec devtools docker rm -f pawmap-dev | Out-Null
}
Write-Host 'Stopped the scoped pawmap-dev container. PostgreSQL, MinIO, and Mailpit remain available.'
