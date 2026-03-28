/**
 * Playwright global setup — intentionally empty.
 *
 * Database seeding is done by tests/seed-and-serve.ts (inside the webServer
 * process) to avoid the race condition where Playwright starts webServers
 * BEFORE globalSetup completes.
 */
export default async function globalSetup() {
  // no-op — seeding handled by seed-and-serve.ts
}
