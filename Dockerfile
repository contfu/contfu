FROM imbios/bun-node:1.1.37-22.11.0-alpine AS build
WORKDIR /app
COPY . .
RUN bun install
RUN bun run build

FROM oven/bun:1.1.37-alpine AS app
WORKDIR /app
ENV DATABASE_URL=file:/app/db/db.sqlite
COPY --from=build /app/services/app/dist ./dist
COPY --from=build /app/services/app/server ./server
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --start-interval=1s CMD [ "bun", "-e", "assert((await fetch('http://localhost:3000/health',{method:'OPTIONS'})).status === 200)" ]
CMD ["bun", "server/entry.bun.js"]

FROM oven/bun:1.1.37-alpine AS sync
ENV PORT=3000\
    MIGRATIONS_FOLDER=/app/migrations\
    DATABASE_URL=file:/app/db/db.sqlite
WORKDIR /app
COPY --from=build /app/services/sync/dist/server.js /app/server.js
COPY ./packages/db/migrations /sync/migrations
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --start-interval=1s CMD [ "bun", "-e", "assert((await fetch('http://localhost:3000/health',{method:'OPTIONS'})).status === 200)" ]
ENTRYPOINT [ "bun", "server.js" ]
