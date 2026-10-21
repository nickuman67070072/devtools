# syntax=docker/dockerfile:1.7
FROM node:22-trixie-slim@sha256:b26b04c123d9ff8ab646ceb18b9d75a1173acf64b9a401094b906d27b29338d4 AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts && npx prisma generate

FROM dependencies AS builder
ARG NEXT_PUBLIC_TERRAIN_URL=
ENV NEXT_PUBLIC_TERRAIN_URL=$NEXT_PUBLIC_TERRAIN_URL
COPY . .
RUN --mount=type=secret,id=database_url \
    --mount=type=secret,id=better_auth_secret \
    DATABASE_URL="$(cat /run/secrets/database_url)" \
    BETTER_AUTH_SECRET="$(cat /run/secrets/better_auth_secret)" \
    npm run build

FROM dependencies AS migrator
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-trixie-slim@sha256:b26b04c123d9ff8ab646ceb18b9d75a1173acf64b9a401094b906d27b29338d4 AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends openssl ca-certificates libpcre2-8-0 && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx && groupadd --system --gid 10001 pawmap && useradd --system --uid 10001 --gid pawmap pawmap
COPY --from=builder --chown=pawmap:pawmap /app/public ./public
COPY --from=builder --chown=pawmap:pawmap /app/.next/standalone ./
COPY --from=builder --chown=pawmap:pawmap /app/.next/static ./.next/static
COPY --chown=pawmap:pawmap infra/workers/meetup-worker.mjs ./workers/meetup-worker.mjs
USER pawmap
EXPOSE 3000
CMD ["node", "server.js"]
