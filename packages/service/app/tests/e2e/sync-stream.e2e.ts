import { test, expect } from "@playwright/test";
import { unpack } from "msgpackr";
import { EventType } from "@contfu/core";
import { SYNC_CONSUMER_KEY } from "./sync-stream.seed";

const VALID_KEY = SYNC_CONSUMER_KEY.toString("base64url");
const RANDOM_INVALID_KEY = Buffer.alloc(32, 0xff).toString("base64url");

/**
 * Reads framed msgpack events from a binary sync stream.
 *
 * The stream uses [4-byte-BE-length][msgpack] framing.
 * Aborts once `until` returns true or the timeout fires.
 */
async function readSyncEvents(opts: {
  baseUrl: string;
  key: string;
  from?: number;
  until: (events: unknown[][]) => boolean;
  timeoutMs?: number;
}): Promise<unknown[][]> {
  const { baseUrl, key, from, until, timeoutMs = 5_000 } = opts;

  const url = new URL("/api/sync", baseUrl);
  url.searchParams.set("key", key);
  if (from !== undefined) {
    url.searchParams.set("from", String(from));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const events: unknown[][] = [];

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok || !response.body) {
      return events;
    }

    const reader = response.body.getReader();
    let buffer = new Uint8Array(0);

    const processBuffer = () => {
      while (buffer.length >= 4) {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const msgLen = view.getUint32(0, false); // big-endian
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
        // AbortError or stream closed
        break;
      }

      if (chunk.done) break;

      // Append new bytes to buffer
      const combined = new Uint8Array(buffer.length + chunk.value.length);
      combined.set(buffer, 0);
      combined.set(chunk.value, buffer.length);
      buffer = combined;

      processBuffer();

      if (controller.signal.aborted) break;
    }
  } catch {
    // Timeout or abort — return what we have
  } finally {
    clearTimeout(timer);
  }

  return events;
}

test.describe("Sync Stream — GET /api/sync", () => {
  test("rejects missing key with 401", async ({ request }) => {
    const response = await request.get("/api/sync");
    expect(response.status()).toBe(401);
  });

  test("rejects invalid key with 401", async ({ request }) => {
    const response = await request.get(`/api/sync?key=${RANDOM_INVALID_KEY}`);
    expect(response.status()).toBe(401);
  });

  test("rejects negative 'from' with 400", async ({ request }) => {
    const response = await request.get(`/api/sync?key=${VALID_KEY}&from=-1`);
    expect(response.status()).toBe(400);
  });

  test("rejects non-numeric 'from' with 400", async ({ request }) => {
    const response = await request.get(`/api/sync?key=${VALID_KEY}&from=abc`);
    expect(response.status()).toBe(400);
  });

  test("delivers SNAPSHOT_START and SNAPSHOT_END for new client connection", async () => {
    const baseUrl = "http://localhost:4173";

    const events = await readSyncEvents({
      baseUrl,
      key: VALID_KEY,
      until: (evts) => evts.some((e) => e[0] === EventType.SNAPSHOT_END),
      timeoutMs: 5_000,
    });

    const types = events.map((e) => e[0]);

    expect(types).toContain(EventType.SNAPSHOT_START);
    expect(types).toContain(EventType.SNAPSHOT_END);
    expect(types).toContain(EventType.COLLECTION_SCHEMA);

    const startIdx = types.indexOf(EventType.SNAPSHOT_START);
    const endIdx = types.indexOf(EventType.SNAPSHOT_END);
    expect(startIdx).toBeLessThan(endIdx);
  });

  test("accepts valid 'from' parameter and opens a streaming connection", async () => {
    const baseUrl = "http://localhost:4173";

    // from=0 is a valid value — the server must not reject it with 4xx.
    // Whether a snapshot starts depends on NATS stream state, so we only
    // verify that the connection opens and we receive at least one framed event.
    const events = await readSyncEvents({
      baseUrl,
      key: VALID_KEY,
      from: 0,
      until: (evts) => evts.length >= 1,
      timeoutMs: 5_000,
    });

    expect(events.length).toBeGreaterThan(0);
  });
});

test.describe("Sync Ack — POST /api/sync/ack", () => {
  test("returns 204 for valid connection key and seq", async ({ request }) => {
    const response = await request.post(`/api/sync/ack?key=${VALID_KEY}&seq=1`);
    expect(response.status()).toBe(204);
  });

  test("rejects invalid key with 401", async ({ request }) => {
    const response = await request.post(`/api/sync/ack?key=${RANDOM_INVALID_KEY}&seq=1`);
    expect(response.status()).toBe(401);
  });

  test("rejects missing seq with 400", async ({ request }) => {
    const response = await request.post(`/api/sync/ack?key=${VALID_KEY}`);
    expect(response.status()).toBe(400);
  });

  test("rejects negative seq with 400", async ({ request }) => {
    const response = await request.post(`/api/sync/ack?key=${VALID_KEY}&seq=-1`);
    expect(response.status()).toBe(400);
  });

  test("rejects non-numeric seq with 400", async ({ request }) => {
    const response = await request.post(`/api/sync/ack?key=${VALID_KEY}&seq=abc`);
    expect(response.status()).toBe(400);
  });
});
