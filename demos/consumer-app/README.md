# Demo Consumer App

A SvelteKit 5 demo application that demonstrates consuming content from the Contfu sync service via WebSocket. This app displays articles synced from upstream CMS platforms (like Strapi) in a clean HTML interface.

## What This Demo Shows

- **Real-time Sync**: Connects to Contfu via WebSocket and receives content updates automatically
- **Content Rendering**: Converts Contfu's block-based content format to HTML using Svelte 5 components
- **Client Library Usage**: Demonstrates how to use `@contfu/client` to consume synced content
- **SvelteKit Features**: Uses SvelteKit 5 with Bun adapter for server-side rendering

## Quick Start

### Local Development

```bash
# From the monorepo root
bun install

# Run in development mode with hot reload
cd demos/consumer-app
bun run dev

# Build and preview production
bun run build
bun run preview
```

The demo app will be available at http://localhost:4000

### Prerequisites

Before starting the demo app, ensure:

1. **Contfu App Service is running** at http://localhost:3001 (port 3000 internally)

   ```bash
   # From monorepo root
   docker compose up app
   ```

2. **A source is configured** in the Contfu app to sync content from your CMS

3. **You have a CONTFU_KEY** (see "Setting up CONTFU_KEY" below)

## Configuration

Environment variables:

| Variable     | Description                                     | Default                      |
| ------------ | ----------------------------------------------- | ---------------------------- |
| `PORT`       | HTTP server port                                | `4000`                       |
| `CONTFU_URL` | WebSocket URL to Contfu sync service            | `ws://localhost:3000/contfu` |
| `CONTFU_KEY` | Connection key for authentication (hex-encoded) | ``                           |

### Setting up CONTFU_KEY

The demo app requires a `CONTFU_KEY` to connect to the Contfu sync service and receive content. Without this key, you'll see "No articles synced yet" instead of actual content.

**How to obtain a key:**

1. **Start the app service**: Ensure the Contfu app service is running at http://localhost:3001

   ```bash
   docker compose up app
   ```

2. **Create a user account**: Visit http://localhost:3001 and register a new user account

3. **Create a client**: Navigate to **Clients** > **New Client** in the app dashboard

4. **Copy the key**: After creating the client, copy the hex-encoded connection key

5. **Run the demo app with the key**:
   ```bash
   cd demos/consumer-app
   CONTFU_KEY=your-hex-encoded-key bun run dev
   ```

**Note**: The Contfu app service also needs to have a source configured that syncs content from a CMS (like Strapi at http://localhost:1337).

## Endpoints

| Path              | Description             |
| ----------------- | ----------------------- |
| `/`               | Article list page       |
| `/articles/:slug` | Individual article page |
| `/health`         | Health check endpoint   |

## How It Works

1. **Connects to Contfu**: On server startup, the app connects to the Contfu sync service via WebSocket using the `@contfu/client` library (via `hooks.server.ts`)
2. **Receives Events**: Content events (`CHANGED`, `DELETED`, etc.) are received in real-time
3. **Stores Articles**: Articles are stored in server-side state and rendered via SvelteKit's SSR
4. **Renders Content**: Contfu's block-based content format (headings, paragraphs, code blocks, images, etc.) is converted to semantic HTML using the `BlockContent` Svelte component

## Tech Stack

- **Runtime**: Bun with SvelteKit 5
- **Framework**: SvelteKit 5 with svelte-adapter-bun
- **Rendering**: Server-side rendering with Svelte 5 runes
- **Client**: `@contfu/client` for WebSocket sync

## Project Structure

```
demos/consumer-app/
├── src/
│   ├── app.html            # HTML template
│   ├── app.css             # Global styles
│   ├── app.d.ts            # TypeScript declarations
│   ├── hooks.server.ts     # Server hooks (sync startup)
│   ├── lib/
│   │   ├── types.ts        # Type definitions
│   │   ├── state.svelte.ts # Article state management
│   │   ├── sync.ts         # WebSocket sync client
│   │   └── components/
│   │       └── BlockContent.svelte  # Block rendering
│   └── routes/
│       ├── +layout.svelte  # Root layout
│       ├── +page.svelte    # Article list page
│       ├── +page.server.ts # List page data loader
│       ├── health/
│       │   └── +server.ts  # Health endpoint
│       └── articles/[slug]/
│           ├── +page.svelte       # Article detail
│           └── +page.server.ts    # Detail data loader
├── package.json            # Dependencies and scripts
├── svelte.config.js        # SvelteKit configuration
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## Learn More

- [Contfu Documentation](../../README.md) - Main project documentation
- [Contfu Client](../../packages/client/client/README.md) - Client library docs
- [PRD](../../PRD.md) - Product requirements document
- [SvelteKit Documentation](https://svelte.dev/docs/kit) - SvelteKit docs
