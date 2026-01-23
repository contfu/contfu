# CLAUDE.md - @contfu/svc-app

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `@contfu/svc-app`
**Purpose:** SvelteKit web application for user authentication, account management, and dashboard

This is the user-facing web application providing authentication, billing, and management interfaces.

## Architecture

### Module Structure

```
src/
├── app.html              # Root HTML template
├── app.css               # Global styles
├── app.d.ts              # TypeScript globals
├── hooks.server.ts       # Server-side hooks
├── entry.bun.ts          # Bun server entry point
├── routes/
│   ├── +page.svelte      # Home page
│   ├── +page.server.ts
│   ├── +layout.svelte    # Root layout
│   ├── +layout.server.ts
│   ├── (app)/
│   │   ├── dashboard/    # Protected dashboard
│   │   └── +layout.server.ts
│   ├── health/           # Health check endpoint
│   ├── login/
│   │   ├── +page.svelte
│   │   ├── +page.server.ts
│   │   └── [provider]/   # OAuth routes
│   ├── register/[token]/ # Registration flow
│   ├── under-construction/
│   └── webhooks/stripe/  # Stripe webhooks
└── lib/
    ├── server/
    │   ├── auth/
    │   │   ├── oauth.ts    # Arctic OAuth setup
    │   │   ├── session.ts  # Session management
    │   │   └── local.ts    # Password auth
    │   ├── db/
    │   │   ├── schema.ts   # Drizzle schema
    │   │   └── db.ts       # Database connection
    │   └── stripe/
    │       ├── stripe.ts   # Stripe client
    │       ├── customers.ts
    │       └── products.ts
    └── components/
        ├── Avatar.svelte
        └── Header.svelte
```

### Core Patterns

**SvelteKit Conventions:**

- `+page.svelte` - Page components
- `+page.server.ts` - Server-side load functions and form actions
- `+layout.svelte/server.ts` - Layouts with shared data loading
- `+server.ts` - API endpoints

**Authentication Flow:**

- OAuth providers via Arctic library
- Local password auth with Argon2 hashing
- Session management with secure cookies
- Registration tokens for invite-only signup

**Route Groups:**

- `(app)/` - Protected routes requiring authentication
- Public routes: login, register, health

### Database Schema

**Tables:** user, session, quota, consumer, source, collection

Schema location: `src/lib/server/db/schema.ts`

## Libraries

| Library            | Version | Purpose                   |
| ------------------ | ------- | ------------------------- |
| @sveltejs/kit      | latest  | Full-stack framework      |
| svelte             | latest  | UI framework              |
| vite               | latest  | Build tool                |
| svelte-adapter-bun | latest  | Bun runtime adapter       |
| arctic             | latest  | OAuth/OIDC authentication |
| argon2             | latest  | Password hashing          |
| drizzle-orm        | latest  | Type-safe ORM             |
| stripe             | latest  | Payment processing        |
| valibot            | latest  | Schema validation         |
| tailwindcss        | latest  | Utility-first CSS         |
| autoprefixer       | latest  | CSS vendor prefixes       |
| postcss            | latest  | CSS processing            |
| playwright         | latest  | E2E testing               |
| typescript         | latest  | Type safety               |

## Coding Best Practices

1. **SvelteKit conventions:** Follow file-based routing patterns
2. **Server-only imports:** Use `$lib/server/` for server-only code
3. **Form actions:** Prefer progressive enhancement with form actions
4. **Type safety:** Use Valibot for runtime validation
5. **Secure auth:** Never expose secrets client-side; use httpOnly cookies

## Development Process

### Testing

E2E testing with Playwright.

```bash
# Run E2E tests
bun run playwright test

# Interactive test UI
bun run playwright test --ui
```

### Commands

```bash
# Development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Serve built app
bun run serve

# Type check
bun run check

# Generate DB migrations
bun run db:generate
```

### Making Changes

1. Follow SvelteKit file conventions
2. Keep server code in `$lib/server/`
3. Validate all inputs with Valibot
4. Test auth flows manually and with Playwright
5. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- SvelteKit's form actions provide excellent progressive enhancement
- Arctic simplifies OAuth implementation across providers
- Argon2 is the recommended password hashing algorithm
- Stripe webhooks need signature verification
- Bun adapter provides fastest runtime for SvelteKit
