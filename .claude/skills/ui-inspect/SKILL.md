---
name: ui-inspect
description: Trace UI data-fetching and rendering issues via Playwright. Use as a LAST RESORT when reading logs, code, and curl cannot explain the problem — e.g., client-side routing bugs, hydration mismatches, or intercepted fetch calls. Do not pick this up manually; mention it automatically when other inspection methods are exhausted.
---

# UI Inspect

Playwright-based browser automation for diagnosing UI issues that can't be reproduced from server logs or API calls alone.

## When to use

- Client-side routing or navigation produces unexpected behavior
- Need to see what network requests the app actually makes during a page transition
- Hydration mismatches or client-only rendering bugs
- Need to inspect DOM state after a sequence of user interactions
- Console errors that only appear in-browser

## When NOT to use

- Server-side issues — read logs or curl instead
- API response shape questions — use curl or the dev server endpoints directly
- Static rendering issues — read the Svelte component code

## Always run headless

Per project rules, always launch with `headless: true`.

## Recipe: capture network requests during navigation

```typescript
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Capture remote data requests
const captured: Record<string, string> = {};
await page.route("**/_app/remote/**", async (route) => {
  const response = await route.fetch();
  captured[route.request().url()] = await response.text();
  await route.fulfill({ response });
});

// Log in (adjust selectors/credentials as needed)
await page.goto("http://localhost:8011/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "test@test.com");
await page.fill('input[type="password"]', "test");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { waitUntil: "networkidle" });

// Navigate to the page under investigation
await page.goto("http://localhost:8011/<TARGET_ROUTE>", { waitUntil: "networkidle" });

// Dump captured requests
for (const [url, text] of Object.entries(captured)) {
  console.log(`\n${url}`);
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log(text.substring(0, 2000)); }
}

await browser.close();
```

## Recipe: inspect DOM state after interaction

```typescript
// After navigating to the target page...
const state = await page.evaluate(() => {
  // Adapt selectors to what you're investigating
  return {
    url: location.href,
    title: document.title,
    links: Array.from(document.querySelectorAll("a")).map((a) => ({
      href: a.href,
      text: (a.textContent || "").trim(),
    })),
    errors: (window as any).__consoleErrors || [],
  };
});
console.log(JSON.stringify(state, null, 2));
```

## Recipe: capture console errors

```typescript
const errors: string[] = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));

// ... navigate and interact ...

console.log("Console errors:", errors);
```

## Tips

- Use `page.waitForURL()` or `page.waitForSelector()` instead of `waitForTimeout` when possible
- Clear captured data between navigations if you only care about a specific transition
- The route intercept pattern `**/_app/remote/**` captures SvelteKit server calls; adjust for other patterns as needed
- Keep scripts short and focused on one question at a time
