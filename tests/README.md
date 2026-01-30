# Tests

This directory contains integration and end-to-end tests for Contfu.

## Structure

```
tests/
├── integration/     # Integration tests with mocked dependencies
│   └── strapi-sync-flow.spec.ts
└── e2e/             # Full end-to-end Playwright tests
    └── strapi-full-flow.e2e.ts
```

## Integration Tests

Integration tests use mocked databases and APIs to test the service layer
in isolation. They're fast and don't require external services.

```bash
# Run integration tests
cd tests/integration && bun test

# Or from the root
bun test tests/integration/
```

## E2E Tests

End-to-end tests launch real servers (Strapi, Service App, Consumer App)
and test the complete user flow through the browser.

**No manual setup required!** Just run:

```bash
cd tests
bun run test:e2e
```

The setup script automatically:

- Extracts pre-built Strapi admin from `strapi-build.tar.gz` (skips 10s build)
- Creates `.env` from `.env.example` if needed
- Installs Strapi dependencies if needed

**Other commands:**

```bash
# Run with Playwright UI (for debugging)
bun run test:e2e:ui

# Run in headed mode (see browser)
bun run test:e2e:headed

# Run setup only (without tests)
bun run setup:e2e
```

**Note:** E2E tests are skipped in CI by default. Set `E2E_FULL_FLOW=true` to run them.

### Updating the Strapi build archive

If you change the Strapi demo (schema, plugins, etc.), rebuild the archive:

```bash
cd demos/strapi-demo
bun install
bun run build
tar -czf strapi-build.tar.gz dist .strapi
git add strapi-build.tar.gz
```

## Adding New Tests

### Integration Tests

- Place in `tests/integration/`
- Use Bun's test runner
- Mock external dependencies
- Name files with `.spec.ts` suffix

### E2E Tests

- Place in `tests/e2e/`
- Use Playwright
- Tests can spawn their own servers or use fixtures
- Name files with `.spec.ts` suffix
