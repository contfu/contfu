import { test, expect } from "../fixtures";
import { unpack } from "msgpackr";
import { EventType, PropertyType } from "@contfu/core";
import { SCHEMA_RESYNC_CONSUMER_KEY, SCHEMA_RESYNC_COLLECTION_NAME } from "./schema-resync.seed";

const VALID_KEY = SCHEMA_RESYNC_CONSUMER_KEY.toString("base64url");

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
  const { baseUrl, key, until, timeoutMs = 10_000 } = opts;

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

test.describe("Schema Resync — COLLECTION_SCHEMA re-broadcast after schema save", () => {
  test.setTimeout(30_000);

  test("broadcasts updated COLLECTION_SCHEMA after schema save via mapping editor", async ({
    authenticatedPage: page,
  }) => {
    const baseUrl = "http://localhost:4173";

    // Connect to the sync stream and wait for the initial COLLECTION_SCHEMA event
    const initialEvents = await readSyncEvents({
      baseUrl,
      key: VALID_KEY,
      until: (evts) =>
        evts.some(
          (e) => e[0] === EventType.COLLECTION_SCHEMA && e[1] === SCHEMA_RESYNC_COLLECTION_NAME,
        ),
      timeoutMs: 10_000,
    });

    const initialSchemaEvent = initialEvents.find(
      (e) => e[0] === EventType.COLLECTION_SCHEMA && e[1] === SCHEMA_RESYNC_COLLECTION_NAME,
    );
    expect(initialSchemaEvent).toBeDefined();
    const initialSchema = initialSchemaEvent![3] as Record<string, number>;
    // Initial schema only has "title"
    expect(initialSchema).toHaveProperty("title");
    expect(initialSchema).not.toHaveProperty("body");

    // Open a new stream connection in background that will capture the re-broadcast
    // We start it before triggering the save so we don't miss the event
    const resyncEventsPromise = readSyncEvents({
      baseUrl,
      key: VALID_KEY,
      until: (evts) =>
        evts.some(
          (e) =>
            e[0] === EventType.COLLECTION_SCHEMA &&
            e[1] === SCHEMA_RESYNC_COLLECTION_NAME &&
            typeof (e[3] as Record<string, number>)?.body === "number",
        ),
      timeoutMs: 15_000,
    });

    // Navigate to the collection's mapping editor page
    await page.goto("/collections");
    const link = page.getByRole("link", { name: "Schema Resync Collection" });
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await page.waitForLoadState("networkidle");

    // Wait for influx rows to be visible
    await expect(page.getByText("Schema Resync Source Collection").first()).toBeVisible({
      timeout: 5000,
    });

    // Add "body" property to the target schema via "Add property" button
    const addPropertyButton = page.getByRole("button", { name: "Add property" });
    await expect(addPropertyButton).toBeVisible({ timeout: 3000 });
    await addPropertyButton.click();

    // A new property row should appear; find the name input and set it to "body"
    const propertyNameInput = page.locator('input[placeholder="Property name"]').last();
    await expect(propertyNameInput).toBeVisible({ timeout: 3000 });
    await propertyNameInput.fill("body");
    await propertyNameInput.press("Tab");

    // Save
    const saveButton = page.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    await saveButton.click();
    await expect(saveButton).not.toBeVisible({ timeout: 10_000 });

    // Wait for the re-broadcast COLLECTION_SCHEMA event with the updated schema
    const resyncEvents = await resyncEventsPromise;

    const updatedSchemaEvent = resyncEvents.find(
      (e) =>
        e[0] === EventType.COLLECTION_SCHEMA &&
        e[1] === SCHEMA_RESYNC_COLLECTION_NAME &&
        typeof (e[3] as Record<string, number>)?.body === "number",
    );
    expect(updatedSchemaEvent).toBeDefined();

    const updatedSchema = updatedSchemaEvent![3] as Record<string, number>;
    expect(updatedSchema).toHaveProperty("title");
    expect(updatedSchema).toHaveProperty("body");
    expect(updatedSchema.body).toBe(PropertyType.STRING);
  });
});
