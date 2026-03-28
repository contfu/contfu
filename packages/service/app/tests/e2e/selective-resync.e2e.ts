import { test, expect } from "../fixtures";
import { unpack } from "msgpackr";
import { EventType } from "@contfu/core";
import { SELECTIVE_RESYNC_CONSUMER_KEY } from "./selective-resync.seed";

const VALID_KEY = SELECTIVE_RESYNC_CONSUMER_KEY.toString("base64url");

/**
 * Reads framed msgpack events from the binary sync stream.
 * Aborts once `until` returns true or the timeout fires.
 */
async function readSyncEvents(opts: {
  baseUrl: string;
  key: string;
  until: (events: unknown[][]) => boolean;
  timeoutMs?: number;
}): Promise<unknown[][]> {
  const { baseUrl, key, until, timeoutMs = 15_000 } = opts;

  const url = new URL("/api/sync", baseUrl);
  url.searchParams.set("key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const events: unknown[][] = [];

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok || !response.body) return events;

    const reader = response.body.getReader();
    let buffer = new Uint8Array(0);

    const processBuffer = () => {
      while (buffer.length >= 4) {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const msgLen = view.getUint32(0, false);
        if (buffer.length < 4 + msgLen) break;

        const msgBytes = buffer.slice(4, 4 + msgLen);
        buffer = buffer.slice(4 + msgLen);

        const event = unpack(msgBytes) as unknown[];
        events.push(event);

        if (until(events)) {
          controller.abort();
          return;
        }
      }
    };

    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        break;
      }
      if (chunk.done) break;

      const combined = new Uint8Array(buffer.length + chunk.value.length);
      combined.set(buffer, 0);
      combined.set(chunk.value, buffer.length);
      buffer = combined;

      processBuffer();
      if (controller.signal.aborted) break;
    }
  } catch {
    // Timeout or abort
  } finally {
    clearTimeout(timer);
  }

  return events;
}

test.describe("Selective Inflow Resync — mapping save triggers resync for changed inflow", () => {
  test.setTimeout(45_000);

  test("saving inflow mappings triggers a resync and items arrive with updated mappings", async ({
    authenticatedPage: page,
  }) => {
    const baseUrl = "http://localhost:4173";

    // 1. Read initial sync stream — wait for SNAPSHOT_END to confirm items are synced
    const initialEvents = await readSyncEvents({
      baseUrl,
      key: VALID_KEY,
      until: (evts) => evts.some((e) => e[0] === EventType.SNAPSHOT_END),
      timeoutMs: 20_000,
    });

    const initialItems = initialEvents.filter((e) => e[0] === EventType.ITEM_CHANGED);
    // Should have 3 items: 2 articles + 1 post
    expect(initialItems.length).toBe(3);

    // Verify items have mapped property names (title, score)
    for (const evt of initialItems) {
      const wireItem = evt[1] as unknown[];
      const props = wireItem[5] as Record<string, unknown>;
      expect(props).toHaveProperty("title");
      expect(props).toHaveProperty("score");
    }

    // 2. Navigate to the collection's mapping editor
    await page.goto("/collections");
    const link = page.getByRole("link", { name: "Selective Resync Collection" });
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await page.waitForLoadState("networkidle");

    // Wait for inflow rows
    await expect(page.getByText("Articles (selective)").first()).toBeVisible({ timeout: 5000 });

    // 3. Add a new target property "hits" and map it from Source A's "views"
    const addPropertyButton = page.getByRole("button", { name: "Add property" });
    await expect(addPropertyButton).toBeVisible({ timeout: 3000 });
    await addPropertyButton.click();

    const propertyNameInput = page.locator('input[placeholder="Property name..."]').last();
    await expect(propertyNameInput).toBeVisible({ timeout: 3000 });
    await propertyNameInput.fill("hits");
    await propertyNameInput.press("Enter");

    // Expand the new "hits" property to configure the mapping
    const accordionItems = page.locator('[data-slot="accordion-item"]');
    const hitsItem = accordionItems.filter({ hasText: "hits" });
    await hitsItem.locator('[data-slot="accordion-trigger"]').click();
    await page.waitForTimeout(150);

    // In the "Articles (selective)" section, select "views" as the source field
    const articlesSection = hitsItem
      .locator("div.rounded-md")
      .filter({ hasText: "Articles (selective)" });
    const sourceSelect = articlesSection.locator("select").first();
    await expect(sourceSelect).toBeVisible({ timeout: 3000 });
    await sourceSelect.selectOption("views");

    // 4. Start listening for new sync events BEFORE saving
    const resyncEventsPromise = readSyncEvents({
      baseUrl,
      key: VALID_KEY,
      until: (evts) => {
        // Wait until we see items with the "hits" property
        const items = evts.filter((e) => e[0] === EventType.ITEM_CHANGED);
        return items.some((e) => {
          const wireItem = e[1] as unknown[];
          const props = wireItem[5] as Record<string, unknown>;
          return "hits" in props;
        });
      },
      timeoutMs: 20_000,
    });

    // 5. Save
    const saveButton = page.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    await saveButton.click();
    await expect(saveButton).not.toBeVisible({ timeout: 10_000 });

    // 6. Wait for resync events
    const resyncEvents = await resyncEventsPromise;

    // Verify: at least one item arrived with the "hits" property
    const resyncItems = resyncEvents.filter((e) => e[0] === EventType.ITEM_CHANGED);
    const itemsWithHits = resyncItems.filter((e) => {
      const wireItem = e[1] as unknown[];
      const props = wireItem[5] as Record<string, unknown>;
      return "hits" in props;
    });
    expect(itemsWithHits.length).toBeGreaterThan(0);

    // The "hits" values should come from articles' "views" field
    for (const evt of itemsWithHits) {
      const wireItem = evt[1] as unknown[];
      const props = wireItem[5] as Record<string, unknown>;
      expect(props.hits).toBeDefined();
    }
  });
});
