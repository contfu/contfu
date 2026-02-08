import { describe, expect, test } from "bun:test";
import { EventType, WIRE_PING, type Block } from "@contfu/core";
import { pack } from "msgpackr";
import { connectToStream } from "./stream-client";

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
 * Create a mock fetch function that returns the given stream.
 */
function createMockFetch(stream: ReadableStream<Uint8Array>, status = 200) {
  return (_url: string) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve("Error"),
      body: stream,
    } as Response);
}

describe("stream-client", () => {
  const testKey = Buffer.alloc(32, 0xab);

  describe("connectToStream basic event parsing", () => {
    test("parses CONNECTED event and yields subsequent events", async () => {
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([EventType.DELETED, new Uint8Array([1, 2, 3, 4])]),
      ];

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: createMockFetch(createMockStream(messages)),
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
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([EventType.CHANGED, wireItem]),
      ];

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: createMockFetch(createMockStream(messages)),
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
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([EventType.CHANGED, wireItem]),
      ];

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: createMockFetch(createMockStream(messages)),
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      const changedEvent = events[0] as { type: number; item: Record<string, unknown> };
      expect(changedEvent.item.publishedAt).toBeUndefined();
      expect(changedEvent.item.content).toBeUndefined();
    });

    test("parses LIST_IDS event", async () => {
      const ids = [new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5, 6])];
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([EventType.LIST_IDS, 42, ids]),
      ];

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: createMockFetch(createMockStream(messages)),
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      const listEvent = events[0] as { type: number; collection: number; ids: Buffer[] };
      expect(listEvent.type).toBe(EventType.LIST_IDS);
      expect(listEvent.collection).toBe(42);
      expect(listEvent.ids).toHaveLength(3);
      expect(listEvent.ids[0].equals(Buffer.from([1, 2]))).toBe(true);
    });

    test("parses CHECKSUM event", async () => {
      const checksum = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([EventType.CHECKSUM, 7, checksum]),
      ];

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: createMockFetch(createMockStream(messages)),
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      const checksumEvent = events[0] as { type: number; collection: number; checksum: Buffer };
      expect(checksumEvent.type).toBe(EventType.CHECKSUM);
      expect(checksumEvent.collection).toBe(7);
      expect(checksumEvent.checksum.equals(Buffer.from([0xde, 0xad, 0xbe, 0xef]))).toBe(true);
    });

    test("ignores PING events", async () => {
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([WIRE_PING]),
        createBinaryMessage([WIRE_PING]),
        createBinaryMessage([EventType.DELETED, new Uint8Array([1])]),
      ];

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: createMockFetch(createMockStream(messages)),
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect((events[0] as { type: number }).type).toBe(EventType.DELETED);
    });
  });

  describe("connection lifecycle events", () => {
    test("yields stream:connected when connectionEvents is true", async () => {
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([EventType.DELETED, new Uint8Array([1])]),
      ];

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        connectionEvents: true,
        _fetch: createMockFetch(createMockStream(messages)),
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: "stream:connected" });
      expect((events[1] as { type: number }).type).toBe(EventType.DELETED);
      expect(events[2]).toEqual({ type: "stream:disconnected", reason: "Stream ended" });
    });

    test("does not yield lifecycle events when connectionEvents is false", async () => {
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([EventType.DELETED, new Uint8Array([1])]),
      ];

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        connectionEvents: false,
        _fetch: createMockFetch(createMockStream(messages)),
      })) {
        events.push(event);
      }

      // Only the DELETED event, no lifecycle events
      expect(events).toHaveLength(1);
      expect((events[0] as { type: number }).type).toBe(EventType.DELETED);
    });
  });

  describe("error handling", () => {
    test("throws on stream ERROR event", async () => {
      const messages = [
        createBinaryMessage([EventType.CONNECTED]),
        createBinaryMessage([EventType.ERROR, "E_ACCESS"]),
      ];

      const events: unknown[] = [];
      let thrownError: Error | null = null;

      try {
        for await (const event of connectToStream(testKey, {
          url: "http://test/stream",
          reconnect: false,
          _fetch: createMockFetch(createMockStream(messages)),
        })) {
          events.push(event);
        }
      } catch (err) {
        thrownError = err as Error;
      }

      expect(events).toHaveLength(0);
      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).toContain("E_ACCESS");
    });

    test("throws on HTTP error when reconnect is false", async () => {
      let thrownError: Error | null = null;

      try {
        for await (const _ of connectToStream(testKey, {
          url: "http://test/stream",
          reconnect: false,
          _fetch: createMockFetch(createMockStream([]), 401),
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
      // Combine two messages into one Uint8Array
      const msg1 = createBinaryMessage([EventType.CONNECTED]);
      const msg2 = createBinaryMessage([EventType.DELETED, new Uint8Array([1])]);
      const msg3 = createBinaryMessage([EventType.DELETED, new Uint8Array([2])]);

      const combined = new Uint8Array(msg1.length + msg2.length + msg3.length);
      combined.set(msg1, 0);
      combined.set(msg2, msg1.length);
      combined.set(msg3, msg1.length + msg2.length);

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: createMockFetch(createMockStream([combined])),
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(2); // Two DELETED events
    });

    test("handles message split across multiple chunks", async () => {
      const fullMessage = createBinaryMessage([EventType.CONNECTED]);
      const msg2 = createBinaryMessage([EventType.DELETED, new Uint8Array([42])]);

      // Split the second message across chunks
      const chunk1 = new Uint8Array(fullMessage.length + 2);
      chunk1.set(fullMessage, 0);
      chunk1.set(msg2.slice(0, 2), fullMessage.length);
      const chunk2 = msg2.slice(2);

      const events: unknown[] = [];
      for await (const event of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: createMockFetch(createMockStream([chunk1, chunk2])),
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect((events[0] as { type: number }).type).toBe(EventType.DELETED);
    });
  });

  describe("URL construction", () => {
    test("uses default URL when not specified", async () => {
      const messages = [createBinaryMessage([EventType.CONNECTED])];
      let calledUrl = "";
      const mockFetch = (url: string) => {
        calledUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          body: createMockStream(messages),
        } as Response);
      };

      for await (const _ of connectToStream(testKey, { reconnect: false, _fetch: mockFetch })) {
        // consume
      }

      expect(calledUrl).toContain("http://localhost:5173/api/stream");
      expect(calledUrl).toContain("key=");
    });

    test("encodes key as base64url in query parameter", async () => {
      const messages = [createBinaryMessage([EventType.CONNECTED])];
      let calledUrl = "";
      const mockFetch = (url: string) => {
        calledUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          body: createMockStream(messages),
        } as Response);
      };

      for await (const _ of connectToStream(testKey, {
        url: "http://test/stream",
        reconnect: false,
        _fetch: mockFetch,
      })) {
        // consume
      }

      const expectedKey = testKey.toString("base64url");
      expect(calledUrl).toBe(`http://test/stream?key=${expectedKey}`);
    });
  });
});
