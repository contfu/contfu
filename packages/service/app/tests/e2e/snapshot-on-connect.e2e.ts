/**
 * E2E test: snapshot triggered immediately on flow creation.
 *
 * Flow:
 * 1. Look up seeded connection and collection IDs via the API.
 * 2. POST /api/v1/flows — creates target→consumer flow, triggers background snapshot.
 * 3. Connect client immediately via GET /api/sync?key=…
 * 4. Verify SNAPSHOT_START + ITEM_CHANGED events + SNAPSHOT_END arrive.
 */
import { test, expect } from "@playwright/test";
import { unpack } from "msgpackr";
import { EventType } from "@contfu/core";
import {
  SNAPSHOT_ON_CONNECT_API_KEY,
  SNAPSHOT_ON_CONNECT_CONSUMER_KEY,
  SNAPSHOT_ON_CONNECT_COLLECTION_NAME,
  SNAPSHOT_ON_CONNECT_CONSUMER_NAME,
} from "./snapshot-on-connect.seed";

const BASE_URL = "http://localhost:4173";
const AUTH_HEADER = `Bearer ${SNAPSHOT_ON_CONNECT_API_KEY}`;
const CONNECTION_KEY = SNAPSHOT_ON_CONNECT_CONSUMER_KEY.toString("base64url");

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

test.describe("Snapshot on flow creation", () => {
  test.setTimeout(30_000);

  test("client receives items immediately after connecting post-creation", async () => {
    // 1. Look up the target collection (the one the flow will connect to the consumer collection)
    const collectionsRes = await fetch(`${BASE_URL}/api/v1/collections`, {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(collectionsRes.status).toBe(200);
    const collections = (await collectionsRes.json()) as Array<{ id: number; name: string }>;

    const targetCollection = collections.find(
      (c) => c.name === SNAPSHOT_ON_CONNECT_COLLECTION_NAME,
    );
    expect(targetCollection, "Target collection not found in API response").toBeDefined();

    const consumerCollection = collections.find(
      (c) => c.name === SNAPSHOT_ON_CONNECT_CONSUMER_NAME,
    );
    expect(consumerCollection, "Consumer collection not found in API response").toBeDefined();

    // 2. Create the flow (target → consumer collection) — triggers background snapshot
    const flowRes = await fetch(`${BASE_URL}/api/v1/flows`, {
      method: "POST",
      headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: targetCollection!.id, targetId: consumerCollection!.id }),
    });
    expect(flowRes.status).toBe(201);

    // 3. Connect client and wait for snapshot to complete
    const events = await readSyncEvents({
      key: CONNECTION_KEY,
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
