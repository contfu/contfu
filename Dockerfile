FROM oven/bun:1.3.11-slim AS base
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
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/service/core/package.json packages/service/core/
COPY packages/service/backend/package.json packages/service/backend/
COPY packages/service/sources/package.json packages/service/sources/
COPY packages/service/sync/package.json packages/service/sync/
COPY packages/service/app/package.json packages/service/app/
COPY packages/client/connect/package.json packages/client/connect/
COPY packages/client/app/package.json packages/client/app/
COPY packages/client/client/package.json packages/client/client/
COPY packages/client/bun-file-store/package.json packages/client/bun-file-store/
COPY packages/client/media-optimizer/package.json packages/client/media-optimizer/
COPY packages/client/media-optimizer-remote/package.json packages/client/media-optimizer-remote/
COPY packages/cli/package.json packages/cli/
COPY packages/ui/package.json packages/ui/
COPY demos/consumer-app/package.json demos/consumer-app/
RUN bun install --ignore-scripts
COPY . .
RUN bun run -F '@contfu/svc-backend' build && \
    bun run -F '@contfu/svc-app' build && \
    bun build packages/service/sync/src/worker.ts \
      --outfile packages/service/sync/dist/worker.js \
      --target bun \
      --external @css-inline/css-inline

FROM base AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y jq && rm -rf /var/lib/apt/lists/*
COPY packages/service/app/package.json /tmp/package.json
RUN jq '{dependencies, trustedDependencies}' /tmp/package.json > /app/package.json && \
    bun install

FROM base AS app
ENV MIGRATIONS_PATH=/app/packages/service/backend/db/migrations
ENV DATABASE_URL=postgres://contfu:contfu@postgres:5432/contfu
ENV SYNC_WORKER_PATH=/app/packages/service/sync/dist/worker.js
WORKDIR /app
# Copy native runtime deps (unbundleable packages with .node bindings)
COPY --from=deps /app/node_modules/ /app/node_modules/
# Copy built SvelteKit app
COPY --from=build /app/packages/service/app/build/ /app/packages/service/app/build/
# Copy bundled sync worker
COPY --from=build /app/packages/service/sync/dist/ /app/packages/service/sync/dist/
# Copy database migrations
COPY packages/service/backend/db/migrations/ /app/packages/service/backend/db/migrations/
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:3000/ || exit 1
CMD ["bun", "run", "./packages/service/app/build/index.js"]
