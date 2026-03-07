/**
 * E2E test: snapshot triggered immediately on consumer-collection creation.
 *
 * Flow:
 * 1. Look up seeded consumer and collection IDs via the API.
 * 2. POST /api/v1/consumer-collections — triggers background snapshot.
 * 3. Connect consumer immediately via GET /api/sync?key=…
 * 4. Verify SNAPSHOT_START + ITEM_CHANGED events + SNAPSHOT_END arrive.
 */
import { test, expect } from "@playwright/test";
import { unpack } from "msgpackr";
import { EventType } from "@contfu/core";
import {
  SNAPSHOT_ON_CONNECT_API_KEY,
  SNAPSHOT_ON_CONNECT_CONSUMER_KEY,
  SNAPSHOT_ON_CONNECT_COLLECTION_NAME,
} from "./snapshot-on-connect.seed";

const BASE_URL = "http://localhost:4173";
const AUTH_HEADER = `Bearer ${SNAPSHOT_ON_CONNECT_API_KEY}`;
const CONSUMER_KEY = SNAPSHOT_ON_CONNECT_CONSUMER_KEY.toString("base64url");

async function readSyncEvents(opts: {
  key: string;
  until: (events: unknown[][]) => boolean;
  timeoutMs?: number;
}): Promise<unknown[][]> {
  const { key, until, timeoutMs = 15_000 } = opts;

  const url = new URL("/api/sync", BASE_URL);
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

test.describe("Snapshot on consumer-collection creation", () => {
  test.setTimeout(30_000);

  test("consumer receives items immediately after connecting post-creation", async () => {
    // 1. Look up consumer ID by name
    const consumersRes = await fetch(`${BASE_URL}/api/v1/consumers`, {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(consumersRes.status).toBe(200);
    const consumers = (await consumersRes.json()) as Array<{ id: number; name: string }>;
    const consumer = consumers.find((c) => c.name === "Snapshot On Connect Consumer");
    expect(consumer, "Consumer not found in API response").toBeDefined();

    // 2. Look up collection ID by name
    const collectionsRes = await fetch(`${BASE_URL}/api/v1/collections`, {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(collectionsRes.status).toBe(200);
    const collections = (await collectionsRes.json()) as Array<{ id: number; name: string }>;
    const collection = collections.find((c) => c.name === SNAPSHOT_ON_CONNECT_COLLECTION_NAME);
    expect(collection, "Collection not found in API response").toBeDefined();

    // 3. Create the consumer-collection — triggers background snapshot
    const connectRes = await fetch(`${BASE_URL}/api/v1/consumer-collections`, {
      method: "POST",
      headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ consumerId: consumer!.id, collectionId: collection!.id }),
    });
    expect(connectRes.status).toBe(201);

    // 4. Connect consumer and wait for snapshot to complete
    const events = await readSyncEvents({
      key: CONSUMER_KEY,
      until: (evts) => evts.some((e) => e[0] === EventType.SNAPSHOT_END),
      timeoutMs: 20_000,
    });

    const types = events.map((e) => e[0]);
    expect(types).toContain(EventType.SNAPSHOT_START);
    expect(types).toContain(EventType.SNAPSHOT_END);

    // Mock Strapi returns 2 articles — verify at least one item arrived
    const items = events.filter((e) => e[0] === EventType.ITEM_CHANGED);
    expect(items.length).toBeGreaterThan(0);

    const startIdx = types.indexOf(EventType.SNAPSHOT_START);
    const endIdx = types.indexOf(EventType.SNAPSHOT_END);
    expect(startIdx).toBeLessThan(endIdx);
  });
});
