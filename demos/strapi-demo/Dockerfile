# Strapi 5 Docker image for integration testing
FROM node:20-alpine

# Install dependencies for better-sqlite3 and healthcheck
RUN apk add --no-cache python3 make g++ wget

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies with npm (more reliable for native modules in Docker)
RUN npm install --legacy-peer-deps

# Copy the rest of the app
COPY . .

# Build the admin panel
RUN npm run build

# Expose Strapi port
EXPOSE 1337

# Set environment variables for SQLite
ENV DATABASE_CLIENT=sqlite
ENV DATABASE_FILENAME=.tmp/data.db
ENV HOST=0.0.0.0
ENV PORT=1337

# Start Strapi
CMD ["npm", "run", "start"]
