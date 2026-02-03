# Strapi 5 test image for E2E testing
# Pre-configured with article content type for contfu integration tests
#
# Build: docker build -t ghcr.io/contfu/strapi-test:latest .
# Run:   docker run -p 1337:1337 ghcr.io/contfu/strapi-test:latest

FROM node:22-alpine AS base

# Install build dependencies for native modules (better-sqlite3, sharp)
RUN apk update && apk add --no-cache \
    build-base \
    gcc \
    autoconf \
    automake \
    zlib-dev \
    libpng-dev \
    vips-dev \
    git \
    python3

WORKDIR /opt/app

# Copy package files
COPY package.json ./

# Install dependencies with npm (not bun - native modules work better)
RUN npm install

# Copy source and config
COPY src/ src/
COPY config/ config/
COPY entrypoint.sh /entrypoint.sh

# Install curl for health checks
USER root
RUN apk add --no-cache curl

# Create required directories
RUN mkdir -p .tmp public/uploads

# Set ownership and permissions
RUN chown -R node:node /opt/app && chmod +x /entrypoint.sh

USER node

# Environment
ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=1337

EXPOSE 1337

ENTRYPOINT ["/entrypoint.sh"]
