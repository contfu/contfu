import { test, expect } from "@playwright/test";
import { unpack } from "msgpackr";
import { EventType } from "@contfu/core";
import { MAPPING_SYNC_CONSUMER_KEY, COLLECTION_NAME } from "./mapping-sync.seed";

const VALID_KEY = MAPPING_SYNC_CONSUMER_KEY.toString("base64url");

/**
 * Reads framed msgpack events from a binary sync stream.
 * The stream uses [4-byte-BE-length][msgpack] framing.
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

test.describe("Mapping Sync — property mappings applied during sync", () => {
  test.setTimeout(30_000);

  let events: unknown[][];

  test.beforeAll(async () => {
    events = await readSyncEvents({
      baseUrl: "http://localhost:4173",
      key: VALID_KEY,
      until: (evts) => evts.some((e) => e[0] === EventType.SNAPSHOT_END),
      timeoutMs: 20_000,
    });
  });

  test("receives SNAPSHOT_START and SNAPSHOT_END", () => {
    const types = events.map((e) => e[0]);
    expect(types).toContain(EventType.SNAPSHOT_START);
    expect(types).toContain(EventType.SNAPSHOT_END);
  });

  test("schema uses target property names (title, score), not source names", () => {
    // Wire format: [EventType.COLLECTION_SCHEMA, name, displayName, schema]
    const schemaEvents = events.filter((e) => e[0] === EventType.COLLECTION_SCHEMA);
    const ourSchema = schemaEvents.find((e) => e[1] === COLLECTION_NAME);
    expect(ourSchema).toBeDefined();

    const schema = ourSchema![3] as Record<string, number>;
    expect(schema).toHaveProperty("title");
    expect(schema).toHaveProperty("score");
    // Source-only names must NOT appear
    expect(schema).not.toHaveProperty("views");
    expect(schema).not.toHaveProperty("heading");
    expect(schema).not.toHaveProperty("rating");
  });

  test("items have mapped property names (title, score)", () => {
    // Wire format: [EventType.ITEM_CHANGED, wireItem, index]
    // wireItem: [sourceType, refUrl, id, collectionName, changedAt, props, content?]
    const itemEvents = events.filter((e) => e[0] === EventType.ITEM_CHANGED);
    expect(itemEvents.length).toBe(2);

    for (const evt of itemEvents) {
      const wireItem = evt[1] as unknown[];
      const props = wireItem[5] as Record<string, unknown>;
      expect(props).toHaveProperty("title");
      expect(props).toHaveProperty("score");
      // Source-only names must NOT appear
      expect(props).not.toHaveProperty("views");
      expect(props).not.toHaveProperty("heading");
      expect(props).not.toHaveProperty("rating");
    }
  });

  test("cast is applied — score values are strings", () => {
    const itemEvents = events.filter((e) => e[0] === EventType.ITEM_CHANGED);

    for (const evt of itemEvents) {
      const wireItem = evt[1] as unknown[];
      const props = wireItem[5] as Record<string, unknown>;
      expect(typeof props.score).toBe("string");
    }
  });

  test("two items total — one from each source", () => {
    const itemEvents = events.filter((e) => e[0] === EventType.ITEM_CHANGED);
    expect(itemEvents.length).toBe(2);

    const titles = itemEvents.map((evt) => {
      const wireItem = evt[1] as unknown[];
      const props = wireItem[5] as Record<string, unknown>;
      return props.title;
    });

    expect(titles).toContain("Article One");
    expect(titles).toContain("Post Alpha");
  });
});
