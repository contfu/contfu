# CI Runner image for contfu E2E tests
# Pre-installed: Bun, Playwright (Chromium), Docker CLI
#
# Build: docker build -t forgejo.rogge.vip/contfu/ci-runner:latest .
# Push:  docker push forgejo.rogge.vip/contfu/ci-runner:latest

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

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash -s -- "bun-v1.3.10"
ENV PATH="/root/.bun/bin:$PATH"

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

# Install Playwright browsers (Chromium only for speed)
RUN bunx playwright install chromium

# Pre-install project dependencies to warm Bun cache
# Copy package files from build context (built from repo root)
COPY . /tmp/contfu/
RUN cd /tmp/contfu && bun install && rm -rf /tmp/contfu

# Verify installations
RUN node --version && bun --version && docker --version

WORKDIR /workspace
