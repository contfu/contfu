FROM oven/bun:1.3.8-slim AS base
WORKDIR /app
RUN apt-get update && \
    apt-get install -y ca-certificates wget && \
    rm -rf /var/lib/apt/lists/*

FROM base AS build-base
WORKDIR /app
RUN apt-get update && \
    apt-get install -y nodejs npm && \
    rm -rf /var/lib/apt/lists/*

FROM build-base AS build
COPY . .
RUN bun install && \
    bun run -F '@contfu/svc-backend' build && \
    bun run -F '@contfu/svc-app' build

FROM base AS deps
WORKDIR /app
COPY package.json bun.lock /app/
COPY packages/core/package.json /app/packages/core/package.json
COPY packages/service/backend/package.json /app/packages/service/backend/package.json
COPY packages/service/sources/package.json /app/packages/service/sources/package.json
COPY packages/service/sync/package.json /app/packages/service/sync/package.json
COPY packages/service/app/package.json /app/packages/service/app/package.json
COPY packages/client/core/package.json /app/packages/client/core/package.json
COPY packages/client/app/package.json /app/packages/client/app/package.json
COPY packages/client/contfu/package.json /app/packages/client/contfu/package.json
COPY packages/client/bun-file-store/package.json /app/packages/client/bun-file-store/package.json
COPY packages/client/media-optimizer/package.json /app/packages/client/media-optimizer/package.json
COPY demos/consumer-app/package.json /app/demos/consumer-app/package.json
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM base AS app
ENV MIGRATIONS_PATH=/app/packages/service/backend/db/migrations
ENV DATABASE_URL=postgres://contfu:contfu@postgres:5432/contfu
ENV SYNC_WORKER_PATH=/app/packages/service/sync/src/worker.ts
WORKDIR /app
# Copy production deps (preserves workspace symlink structure)
COPY --from=deps /app/ /app/
# Copy built artifacts
COPY --from=build /app/packages/service/app/build/ /app/packages/service/app/build/
COPY --from=build /app/packages/service/backend/dist/ /app/packages/service/backend/dist/
COPY --from=build /app/packages/core/src/ /app/packages/core/src/
COPY --from=build /app/packages/service/sync/src/ /app/packages/service/sync/src/
COPY --from=build /app/packages/service/sync/node_modules/ /app/packages/service/sync/node_modules/
# Copy database migrations
COPY packages/service/backend/db/migrations/ /app/packages/service/backend/db/migrations/
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:3000/ || exit 1
CMD ["bun", "run", "./packages/service/app/build/index.js"]
