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

FROM build-base AS deps
COPY bun.lock /app/
RUN bun install --no-save @css-inline/css-inline

FROM base AS app
ENV MIGRATIONS_PATH=/app/db/migrations
ENV DATABASE_URL=/data/db/contfu.sqlite
COPY --from=build /app/packages/service/app/build/ /app/
COPY --from=build /app/packages/service/backend/dist/ /app/node_modules/@contfu/svc-backend/dist/
COPY --from=build /app/packages/service/backend/package.json /app/node_modules/@contfu/svc-backend/package.json
COPY --from=build /app/packages/core/contfu/ /app/node_modules/@contfu/core/
COPY --from=build /app/packages/service/sync/ /app/packages/service/sync/
COPY packages/service/backend/db/migrations/ /app/db/migrations/
COPY --from=deps /app/node_modules/ /app/node_modules/
EXPOSE 3000
CMD ["bun", "run", "./index.js"]
