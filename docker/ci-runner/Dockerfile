# CI Runner image for contfu E2E tests
# Pre-installed: Bun, Playwright (Chromium), Docker CLI
#
# Build: docker build -t registry.sven-rogge.com/contfu/ci-runner:latest .
# Push:  docker push registry.sven-rogge.com/contfu/ci-runner:latest

FROM ubuntu:24.04

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (required for GitHub Actions like actions/checkout)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Bun to a system-wide location so any user can run it
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash -s -- "bun-v1.3.11"

# Install Playwright dependencies and browsers
# Using npx since bunx sometimes has issues with playwright install
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2t64 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browsers to a system-wide path readable by any user
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN bunx playwright install chromium && chmod -R a+rx /opt/ms-playwright

# Pre-install project dependencies to warm Bun cache.
# Dockerfile.dockerignore includes only bun.lock and **/package.json (with
# intermediate dirs), so new workspace packages are picked up automatically.
COPY . /tmp/contfu/
RUN cd /tmp/contfu && bun install && rm -rf /tmp/contfu

# Verify installations
RUN node --version && bun --version && docker --version

# Run as the host runner user (UID 1000) so files written to the mounted
# workspace are owned by the runner user, not root.
# Ubuntu 24.04 ships an 'ubuntu' user at UID 1000; rename it rather than
# creating a new user (which would fail with "UID is not unique").
RUN existing=$(getent passwd 1000 | cut -d: -f1); \
    if [ -n "$existing" ] && [ "$existing" != "runner" ]; then \
        usermod -l runner -d /home/runner -m "$existing"; \
    elif [ -z "$existing" ]; then \
        useradd -u 1000 -m -s /bin/bash runner; \
    fi
USER runner

WORKDIR /workspace
