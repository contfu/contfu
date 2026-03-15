import { afterEach, describe, expect, test } from "bun:test";
import { EventType, ConnectionType, type Block } from "@contfu/core";
import { pack } from "msgpackr";
import { connectToStream, resolveSyncTransport } from "./stream-client";

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
  const originalWebSocket = globalThis.WebSocket;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPreview = process.env.VITE_PREVIEW;
  const originalTransport = process.env.CONTFU_SYNC_TRANSPORT;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.VITE_PREVIEW = originalPreview;
    process.env.CONTFU_SYNC_TRANSPORT = originalTransport;
  });

  describe("connectToStream basic event parsing", () => {
    test("parses indexed DELETED event", async () => {
      mockFetch(
        createMockStream([
          createBinaryMessage([EventType.ITEM_DELETED, new Uint8Array([1, 2, 3, 4]), 11]),
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
        type: EventType.ITEM_DELETED,
        item: expect.any(Buffer),
        index: 11,
      });
      expect((events[0] as { item: Buffer }).item.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
    });

    test("parses indexed CHANGED event with full item", async () => {
      const ref = "https://example.com/article/42";
      const id = new Uint8Array([0x03, 0x04]);
      const content: Block[] = [["p", ["Hello"]]];

      const props = {
        title: "Test",
        tags: [new Uint8Array([1]), new Uint8Array([2])],
        publishedAt: 1700000000,
        createdAt: 1699000000,
      };
      const wireItem = [ConnectionType.WEB, ref, id, "article", 1700500000, props, content];
      mockFetch(createMockStream([createBinaryMessage([EventType.ITEM_CHANGED, wireItem, 42])]));

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
      expect(changedEvent.type).toBe(EventType.ITEM_CHANGED);
      expect(changedEvent.index).toBe(42);
      expect(changedEvent.item.collection).toBe("article");
      expect(changedEvent.item.connectionType).toBe(ConnectionType.WEB);
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
          createBinaryMessage([EventType.ITEM_DELETED, new Uint8Array([1])]),
          createBinaryMessage([
            EventType.ITEM_CHANGED,
            [null, null, new Uint8Array([2]), "c", 1, {}],
          ]),
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
          createBinaryMessage([EventType.PING]),
          createBinaryMessage([EventType.PING]),
          createBinaryMessage([EventType.PING]),
          createBinaryMessage([EventType.ITEM_DELETED, new Uint8Array([1]), 7]),
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
      expect((events[0] as { type: number }).type).toBe(EventType.ITEM_DELETED);
    });
  });

  describe("connection lifecycle events", () => {
    test("yields stream lifecycle events", async () => {
      mockFetch(
        createMockStream([createBinaryMessage([EventType.ITEM_DELETED, new Uint8Array([1]), 2])]),
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
      expect(events[0]).toEqual({ type: EventType.STREAM_CONNECTED });
      expect((events[1] as { type: number }).type).toBe(EventType.ITEM_DELETED);
      expect(events[2]).toEqual({ type: EventType.STREAM_DISCONNECTED, reason: "Stream ended" });
    });
  });

  describe("websocket transport", () => {
    test("parses binary websocket messages", async () => {
      const sockets: MockWebSocket[] = [];
      globalThis.WebSocket = createMockWebSocketClass(sockets) as typeof WebSocket;

      const eventsPromise = collectEvents(async () => {
        const events: unknown[] = [];
        for await (const event of connectToStream({
          key: testKey,
          url: "http://test/sync",
          transport: "websocket",
          reconnect: false,
          connectionEvents: true,
        })) {
          events.push(event);
        }
        return events;
      });

      await waitFor(() => sockets.length === 1 && sockets[0].ready());
      sockets[0].emit(pack([EventType.ITEM_DELETED, new Uint8Array([9, 8]), 12]));
      sockets[0].close(1000, "done");

      const events = await eventsPromise;
      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: EventType.STREAM_CONNECTED });
      expect(events[1]).toEqual({
        type: EventType.ITEM_DELETED,
        item: expect.any(Buffer),
        index: 12,
      });
      expect((events[1] as { item: Buffer }).item.equals(Buffer.from([9, 8]))).toBe(true);
      expect(events[2]).toEqual({ type: EventType.STREAM_DISCONNECTED, reason: "done" });
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

  describe("transport selection", () => {
    test("defaults to websocket in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.VITE_PREVIEW;
      delete process.env.CONTFU_SYNC_TRANSPORT;
      expect(resolveSyncTransport()).toBe("websocket");
    });

    test("defaults to http in local development", () => {
      process.env.NODE_ENV = "development";
      delete process.env.VITE_PREVIEW;
      delete process.env.CONTFU_SYNC_TRANSPORT;
      expect(resolveSyncTransport()).toBe("http");
    });

    test("honors explicit env override", () => {
      process.env.NODE_ENV = "production";
      process.env.CONTFU_SYNC_TRANSPORT = "http";
      expect(resolveSyncTransport()).toBe("http");
    });
  });
});

type MockWebSocket = {
  ready: () => boolean;
  emit: (data: Uint8Array) => void;
  close: (code?: number, reason?: string) => void;
};

function createMockWebSocketClass(sockets: MockWebSocket[]) {
  return class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    binaryType: BinaryType = "blob";
    readyState = 1;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;

    constructor(public readonly url: string) {
      sockets.push({
        ready: () => this.onmessage != null && this.onclose != null,
        emit: (data) => {
          this.onmessage?.({
            data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
          } as MessageEvent);
        },
        close: (code = 1000, reason = "") => {
          this.readyState = 3;
          this.onclose?.({ code, reason } as CloseEvent);
        },
      });
      queueMicrotask(() => this.onopen?.({} as Event));
    }

    send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {}

    close(code = 1000, reason = "") {
      this.readyState = 3;
      this.onclose?.({ code, reason } as CloseEvent);
    }
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("Condition not met");
}

async function collectEvents<T>(run: () => Promise<T>): Promise<T> {
  return await run();
}
