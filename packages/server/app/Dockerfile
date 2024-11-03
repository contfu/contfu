FROM oven/bun:1.1.34-slim AS build
ADD ./ /build
WORKDIR /build
RUN bun install &&\
    cd packages/server/app &&\
    bun run build

FROM oven/bun:1.1.34-alpine
ENV PORT=3000
WORKDIR /app
COPY --from=build /build/packages/server/app/dist/server.js /app/
ENTRYPOINT [ "bun", "server.js" ]
