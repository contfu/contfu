# Demo Consumer App Dockerfile (SvelteKit 5)
# Build from monorepo root to access workspace dependencies

FROM oven/bun:1.3.11-slim AS base
WORKDIR /app
RUN apt-get update && \
    apt-get install -y ca-certificates wget nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files for the monorepo
COPY package.json bun.lock ./

# Copy workspace package.json files
COPY packages/core/package.json ./packages/core/
COPY packages/client/client/package.json ./packages/client/client/
COPY demos/consumer-app/package.json ./demos/consumer-app/

# Install all dependencies
RUN bun install --frozen-lockfile

# Build stage
FROM deps AS build
WORKDIR /app

# Copy source files
COPY packages/core/ ./packages/core/
COPY packages/client/client/ ./packages/client/client/
COPY demos/consumer-app/ ./demos/consumer-app/

# Build the SvelteKit consumer app
WORKDIR /app/demos/consumer-app
RUN bun run build

# Runtime stage
FROM base AS runtime
WORKDIR /app

# Copy built SvelteKit app
COPY --from=build /app/demos/consumer-app/build/ ./

# Set environment variables
ENV PORT=4000
ENV CONTFU_URL=ws://app:3000/contfu

EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --spider -q http://localhost:4000/health || exit 1

CMD ["bun", "run", "./index.js"]
