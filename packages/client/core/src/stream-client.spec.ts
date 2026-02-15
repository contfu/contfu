import { afterEach, describe, expect, test } from "bun:test";
import { EventType, WIRE_PING, type Block } from "@contfu/core";
import { pack } from "msgpackr";
import { connectToStream, IndexExpiredError } from "./stream-client";

/**
 * Helper to create a length-prefixed binary message (matching server format).
 * Format: [4-byte big-endian length][msgpack data]
 */
function createBinaryMessage(wireEvent: unknown): Uint8Array {
  const encoded = pack(wireEvent);
  const lengthPrefix = new Uint8Array(4);
  const view = new DataView(lengthPrefix.buffer);
  view.setUint32(0, encoded.length, false); // big-endian
  const result = new Uint8Array(lengthPrefix.length + encoded.length);
  result.set(lengthPrefix);
  result.set(encoded, lengthPrefix.length);
  return result;
}

/**
 * Helper to create a mock ReadableStream from binary messages.
 */
function createMockStream(messages: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < messages.length) {
        controller.enqueue(messages[index]);
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Mock globalThis.fetch to return the given stream with the given status.
 */
function mockFetch(stream: ReadableStream<Uint8Array>, status = 200) {
  globalThis.fetch = ((_url: string) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve("Error"),
      body: stream,
    })) as typeof fetch;
}

/**
 * Mock globalThis.fetch with a custom function that captures the URL.
 */
function mockFetchCapture(
  messages: Uint8Array[],
  status = 200,
): { getUrl: () => string; getCallCount: () => number } {
  let calledUrl = "";
  let callCount = 0;
  globalThis.fetch = ((_url: string) => {
    calledUrl = _url;
    callCount++;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve("Error"),
      body: createMockStream(messages),
    });
  }) as typeof fetch;
  return {
    getUrl: () => calledUrl,
    getCallCount: () => callCount,
  };
}

describe("stream-client", () => {
  const testKey = Buffer.alloc(32, 0xab);
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("connectToStream basic event parsing", () => {
    test("parses DELETED event", async () => {
      mockFetch(
        createMockStream([createBinaryMessage([EventType.DELETED, new Uint8Array([1, 2, 3, 4])])]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: EventType.DELETED,
        item: expect.any(Buffer),
      });
      expect((events[0] as { item: Buffer }).item.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
    });

    test("parses CHANGED event with full item", async () => {
      const ref = new Uint8Array([0x01, 0x02]);
      const id = new Uint8Array([0x03, 0x04]);
      const props = { title: "Test", tags: [new Uint8Array([1]), new Uint8Array([2])] };
      const content: Block[] = [{ type: "paragraph", children: [{ type: "text", text: "Hello" }] }];

      const wireItem = [ref, id, 1, 1700000000, 1699000000, 1700500000, props, content];
      mockFetch(createMockStream([createBinaryMessage([EventType.CHANGED, wireItem])]));

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      const changedEvent = events[0] as { type: number; item: Record<string, unknown> };
      expect(changedEvent.type).toBe(EventType.CHANGED);
      expect(changedEvent.item.collection).toBe(1);
      expect(changedEvent.item.publishedAt).toBe(1700000000);
      expect(changedEvent.item.createdAt).toBe(1699000000);
      expect(changedEvent.item.changedAt).toBe(1700500000);
      expect(changedEvent.item.content).toEqual(content);

      // Check props with deserialized Buffer arrays
      const itemProps = changedEvent.item.props as Record<string, unknown>;
      expect(itemProps.title).toBe("Test");
      expect(Array.isArray(itemProps.tags)).toBe(true);
    });

    test("parses CHANGED event without content", async () => {
      const wireItem = [
        new Uint8Array([0x01]),
        new Uint8Array([0x02]),
        2,
        0, // no publishedAt
        1699000000,
        1700500000,
        { status: "draft" },
      ];
      mockFetch(createMockStream([createBinaryMessage([EventType.CHANGED, wireItem])]));

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      const changedEvent = events[0] as { type: number; item: Record<string, unknown> };
      expect(changedEvent.item.publishedAt).toBeUndefined();
      expect(changedEvent.item.content).toBeUndefined();
    });

    test("ignores PING events", async () => {
      mockFetch(
        createMockStream([
          createBinaryMessage([WIRE_PING]),
          createBinaryMessage([WIRE_PING]),
          createBinaryMessage([EventType.DELETED, new Uint8Array([1])]),
        ]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect((events[0] as { type: number }).type).toBe(EventType.DELETED);
    });
  });

  describe("connection lifecycle events", () => {
    test("yields stream:connected from HTTP response when connectionEvents is true", async () => {
      mockFetch(createMockStream([createBinaryMessage([EventType.DELETED, new Uint8Array([1])])]));

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        connectionEvents: true,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: "stream:connected" });
      expect((events[1] as { type: number }).type).toBe(EventType.DELETED);
      expect(events[2]).toEqual({ type: "stream:disconnected", reason: "Stream ended" });
    });

    test("does not yield lifecycle events when connectionEvents is false", async () => {
      mockFetch(createMockStream([createBinaryMessage([EventType.DELETED, new Uint8Array([1])])]));

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        connectionEvents: false,
      })) {
        events.push(event);
      }

      // Only the DELETED event, no lifecycle events
      expect(events).toHaveLength(1);
      expect((events[0] as { type: number }).type).toBe(EventType.DELETED);
    });
  });

  describe("error handling", () => {
    test("throws on HTTP error when reconnect is false", async () => {
      mockFetch(createMockStream([]), 401);
      let thrownError: Error | null = null;

      try {
        for await (const _ of connectToStream(testKey, {
          url: "http://test/stream",
          reconnect: false,
        })) {
          // Should not yield anything
        }
      } catch (err) {
        thrownError = err as Error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).toContain("401");
    });
  });

  describe("message framing", () => {
    test("handles multiple messages in single chunk", async () => {
      const msg1 = createBinaryMessage([EventType.DELETED, new Uint8Array([1])]);
      const msg2 = createBinaryMessage([EventType.DELETED, new Uint8Array([2])]);

      const combined = new Uint8Array(msg1.length + msg2.length);
      combined.set(msg1, 0);
      combined.set(msg2, msg1.length);

      mockFetch(createMockStream([combined]));

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
    });

    test("handles message split across multiple chunks", async () => {
      const msg1 = createBinaryMessage([EventType.DELETED, new Uint8Array([42])]);

      // Split the message across chunks
      const chunk1 = msg1.slice(0, 2);
      const chunk2 = msg1.slice(2);

      mockFetch(createMockStream([chunk1, chunk2]));

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect((events[0] as { type: number }).type).toBe(EventType.DELETED);
    });
  });

  describe("URL construction", () => {
    test("uses default URL when not specified", async () => {
      const { getUrl } = mockFetchCapture([]);

      for await (const _ of connectToStream(testKey, { reconnect: false })) {
        // consume
      }

      expect(getUrl()).toContain("http://localhost:5173/api/stream");
      expect(getUrl()).toContain("key=");
    });

    test("encodes key as base64url in query parameter", async () => {
      const { getUrl } = mockFetchCapture([]);

      for await (const _ of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        // consume
      }

      const expectedKey = testKey.toString("base64url");
      expect(getUrl()).toBe(`http://test/stream?key=${expectedKey}`);
    });
  });

  describe("indexed event parsing", () => {
    test("parses CHANGED event with eventIndex", async () => {
      const ref = new Uint8Array([0x01, 0x02]);
      const id = new Uint8Array([0x03, 0x04]);
      const wireItem = [ref, id, 1, 1700000000, 1699000000, 1700500000, { title: "Test" }];

      mockFetch(createMockStream([createBinaryMessage([EventType.CHANGED, wireItem, 42])]));

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      const indexed = events[0] as {
        type: number;
        eventIndex: number;
        item: Record<string, unknown>;
      };
      expect(indexed.type).toBe(EventType.CHANGED);
      expect(indexed.eventIndex).toBe(42);
      expect(indexed.item.collection).toBe(1);
    });

    test("parses DELETED event with eventIndex", async () => {
      const itemId = new Uint8Array([0x05, 0x06, 0x07]);

      mockFetch(createMockStream([createBinaryMessage([EventType.DELETED, itemId, 99])]));

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      const indexed = events[0] as { type: number; eventIndex: number; item: Buffer };
      expect(indexed.type).toBe(EventType.DELETED);
      expect(indexed.eventIndex).toBe(99);
      expect(indexed.item.equals(Buffer.from([0x05, 0x06, 0x07]))).toBe(true);
    });
  });

  describe("from parameter URL construction", () => {
    test("from option appends &from=N", async () => {
      const { getUrl } = mockFetchCapture([]);

      for await (const _ of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        from: 42,
      })) {
        // consume
      }

      expect(getUrl()).toContain("&from=42");
    });

    test("no from does not add param", async () => {
      const { getUrl } = mockFetchCapture([]);

      for await (const _ of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
      })) {
        // consume
      }

      expect(getUrl()).not.toContain("from=");
    });

    test("from=0 is appended", async () => {
      const { getUrl } = mockFetchCapture([]);

      for await (const _ of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        from: 0,
      })) {
        // consume
      }

      expect(getUrl()).toContain("&from=0");
    });
  });

  describe("IndexExpiredError", () => {
    test("410 throws IndexExpiredError", async () => {
      mockFetch(createMockStream([]), 410);
      let thrownError: Error | null = null;

      try {
        for await (const _ of connectToStream(testKey, {
          url: "http://test/stream",
          reconnect: false,
        })) {
          // Should not yield anything
        }
      } catch (err) {
        thrownError = err as Error;
      }

      expect(thrownError).toBeInstanceOf(IndexExpiredError);
    });

    test("410 propagates even with reconnect: true", async () => {
      const { getCallCount } = mockFetchCapture([], 410);
      let thrownError: Error | null = null;

      try {
        for await (const _ of connectToStream(testKey, {
          url: "http://test/stream",
          reconnect: true,
        })) {
          // Should not yield anything
        }
      } catch (err) {
        thrownError = err as Error;
      }

      expect(thrownError).toBeInstanceOf(IndexExpiredError);
      expect(getCallCount()).toBe(1);
    });
  });
});
