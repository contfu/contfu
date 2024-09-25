FROM oven/bun:1.1.29-slim AS build
ADD ./ /build
WORKDIR /build
RUN bun install &&\
    cd server/app &&\
    bun run build

FROM oven/bun:1.1.29-alpine
ENV PORT=3000
WORKDIR /app
COPY --from=build /build/server/app/dist/server.js /app/
ENTRYPOINT [ "bun", "server.js" ]
