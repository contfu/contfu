FROM imbios/bun-node:1.1.38-22.11.0-alpine AS build
WORKDIR /app
COPY . .
RUN bun install
RUN bun run build

FROM oven/bun:1.1.38-alpine AS base

FROM base AS app
WORKDIR /app
ENV DATABASE_URL=file:/data/local.db
COPY --from=build /app/services/app/dist ./dist
COPY --from=build /app/services/app/server ./server
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --start-interval=1s CMD [ "bun", "-e", "assert((await fetch('http://localhost:3000/health',{method:'OPTIONS'})).status === 200)" ]
CMD ["bun", "server/entry.bun.js"]

FROM base AS sync
ENV PORT=3000\
    DATABASE_URL=file:/data/local.db
WORKDIR /app
COPY --from=build /app/services/sync/dist/server.js ./server.js
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --start-interval=1s CMD [ "bun", "-e", "assert((await fetch('http://localhost:3000/health',{method:'OPTIONS'})).status === 200)" ]
ENTRYPOINT [ "bun", "server.js" ]

FROM base AS migrator
ENV DATABASE_URL=file:/data/local.db
WORKDIR /app
COPY --from=build /app/services/app/dist ./dist
COPY --from=build /app/services/app/server ./server
COPY ./services/app/src/db/migrations ./migrations
ENTRYPOINT [ "bun", "-e", "import('./dist/db/db.js')" ]
