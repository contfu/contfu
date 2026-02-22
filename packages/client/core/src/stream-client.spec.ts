import { afterEach, describe, expect, test } from "bun:test";
import { EventType, SourceType, WIRE_PING, type Block } from "@contfu/core";
import { pack } from "msgpackr";
import { connectToStream } from "./stream-client";

function createBinaryMessage(wireEvent: unknown): Uint8Array {
  const encoded = pack(wireEvent);
  const lengthPrefix = new Uint8Array(4);
  const view = new DataView(lengthPrefix.buffer);
  view.setUint32(0, encoded.length, false);
  const result = new Uint8Array(lengthPrefix.length + encoded.length);
  result.set(lengthPrefix);
  result.set(encoded, lengthPrefix.length);
  return result;
}

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

function mockFetch(stream: ReadableStream<Uint8Array>, status = 200) {
  globalThis.fetch = ((_url: string) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve("Error"),
      body: stream,
    })) as typeof fetch;
}

function mockFetchCapture(
  messages: Uint8Array[],
  status = 200,
): { getUrl: () => string; getCallCount: () => number; getUrls: () => string[] } {
  const calledUrls: string[] = [];
  let callCount = 0;
  globalThis.fetch = ((_url: string) => {
    calledUrls.push(_url);
    callCount++;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve("Error"),
      body: createMockStream(messages),
    });
  }) as typeof fetch;
  return {
    getUrl: () => calledUrls[calledUrls.length - 1] ?? "",
    getCallCount: () => callCount,
    getUrls: () => [...calledUrls],
  };
}

describe("stream-client", () => {
  const testKey = Buffer.alloc(32, 0xab);
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("connectToStream basic event parsing", () => {
    test("parses indexed DELETED event", async () => {
      mockFetch(
        createMockStream([
          createBinaryMessage([EventType.DELETED, new Uint8Array([1, 2, 3, 4]), 11]),
        ]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
        url: "http://test/sync",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: EventType.DELETED,
        item: expect.any(Buffer),
        index: 11,
      });
      expect((events[0] as { item: Buffer }).item.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
    });

    test("parses indexed CHANGED event with full item", async () => {
      const ref = "https://example.com/article/42";
      const id = new Uint8Array([0x03, 0x04]);
      const content: Block[] = [{ type: "paragraph", children: [{ type: "text", text: "Hello" }] }];

      const props = {
        title: "Test",
        tags: [new Uint8Array([1]), new Uint8Array([2])],
        publishedAt: 1700000000,
        createdAt: 1699000000,
      };
      const wireItem = [SourceType.WEB, ref, id, "article", 1700500000, props, content];
      mockFetch(createMockStream([createBinaryMessage([EventType.CHANGED, wireItem, 42])]));

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
        url: "http://test/sync",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      const changedEvent = events[0] as {
        type: number;
        item: Record<string, unknown>;
        index: number;
      };
      expect(changedEvent.type).toBe(EventType.CHANGED);
      expect(changedEvent.index).toBe(42);
      expect(changedEvent.item.collection).toBe("article");
      expect(changedEvent.item.sourceType).toBe(SourceType.WEB);
      expect(changedEvent.item.ref).toBe(ref);
      const itemProps = changedEvent.item.props as Record<string, unknown>;
      expect(itemProps.publishedAt).toBe(1700000000);
      expect(itemProps.createdAt).toBe(1699000000);
      expect(changedEvent.item.changedAt).toBe(1700500000);
      expect(changedEvent.item.content).toEqual(content);
      expect(itemProps.title).toBe("Test");
      expect(Array.isArray(itemProps.tags)).toBe(true);
    });

    test("ignores non-indexed item events", async () => {
      mockFetch(
        createMockStream([
          createBinaryMessage([EventType.DELETED, new Uint8Array([1])]),
          createBinaryMessage([EventType.CHANGED, [null, null, new Uint8Array([2]), "c", 1, {}]]),
        ]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
        url: "http://test/sync",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
    });

    test("ignores PING events", async () => {
      mockFetch(
        createMockStream([
          createBinaryMessage([WIRE_PING]),
          createBinaryMessage([WIRE_PING]),
          createBinaryMessage([EventType.DELETED, new Uint8Array([1]), 7]),
        ]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
        url: "http://test/sync",
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect((events[0] as { type: number }).type).toBe(EventType.DELETED);
    });
  });

  describe("connection lifecycle events", () => {
    test("yields stream lifecycle events", async () => {
      mockFetch(
        createMockStream([createBinaryMessage([EventType.DELETED, new Uint8Array([1]), 2])]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
        url: "http://test/sync",
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
  });

  describe("error handling", () => {
    test("throws on HTTP error when reconnect is false", async () => {
      mockFetch(createMockStream([]), 401);
      let thrownError: Error | null = null;

      try {
        for await (const _ of connectToStream({
          key: testKey,
          url: "http://test/sync",
          reconnect: false,
        })) {
          // noop
        }
      } catch (err) {
        thrownError = err as Error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).toContain("401");
    });
  });

  describe("URL construction", () => {
    test("uses default sync URL when not specified", async () => {
      const { getUrl } = mockFetchCapture([]);

      for await (const _ of connectToStream({ key: testKey, reconnect: false })) {
        // consume
      }

      expect(getUrl()).toContain("http://localhost:5173/api/sync");
      expect(getUrl()).toContain("key=");
    });

    test("encodes key as base64url in query parameter", async () => {
      const { getUrls } = mockFetchCapture([]);

      for await (const _ of connectToStream({
        key: testKey,
        url: "http://test/sync",
        reconnect: false,
      })) {
        // consume
      }

      const expectedKey = testKey.toString("base64url");
      const syncUrl = getUrls().find((u) => u.includes("/sync?"));
      expect(syncUrl).toBe(`http://test/sync?key=${expectedKey}`);
    });

    test("from option appends from parameter", async () => {
      const { getUrls } = mockFetchCapture([]);

      for await (const _ of connectToStream({
        key: testKey,
        url: "http://test/sync",
        reconnect: false,
        from: 42,
      })) {
        // consume
      }

      const syncUrl = getUrls().find((u) => u.includes("/sync?"));
      expect(syncUrl).toContain("&from=42");
    });
  });
});
