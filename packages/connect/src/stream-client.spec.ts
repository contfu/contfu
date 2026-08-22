/* oxlint-disable typescript/await-thenable -- Linux type-aware lint reports false positives for async iterator tests here */
import { afterEach, describe, expect, test } from "bun:test";
import {
  ApplicationCommand,
  CommandResult,
  EventType,
  RefreshStatus,
  type Block,
} from "@contfu/core";
import { pack, unpack } from "msgpackr";
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
  globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;
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
  globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;
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

async function withImmediateReconnectDelays<T>(run: (delays: number[]) => Promise<T>): Promise<T> {
  const originalSetTimeout = globalThis.setTimeout;
  const delays: number[] = [];

  globalThis.setTimeout = ((
    handler: (...args: unknown[]) => void,
    timeout?: number,
    ...args: unknown[]
  ) => {
    delays.push(timeout ?? 0);
    queueMicrotask(() => handler(...args));
    return 1 as unknown as Timer;
  }) as typeof setTimeout;

  try {
    return await run(delays);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
}

type MockReadResult = { value: Uint8Array | undefined; done: boolean };

function createStallingBody() {
  let resolveRead: ((result: MockReadResult) => void) | null = null;
  let cancelled = false;
  let readStarted = false;

  return {
    isReading() {
      return readStarted;
    },
    getReader() {
      return {
        read() {
          readStarted = true;
          if (cancelled) {
            return Promise.resolve({ value: undefined, done: true });
          }
          return new Promise<MockReadResult>((resolve) => {
            resolveRead = resolve;
          });
        },
        cancel() {
          cancelled = true;
          resolveRead?.({ value: undefined, done: true });
          return Promise.resolve();
        },
      };
    },
  };
}

function createRejectedCloseBody() {
  let rejectRead: ((error: Error) => void) | null = null;
  let readStarted = false;

  return {
    body: {
      getReader() {
        return {
          read() {
            readStarted = true;
            return new Promise<MockReadResult>((_resolve, reject) => {
              rejectRead = reject;
            });
          },
          cancel() {
            const err = new TypeError("terminated");
            rejectRead?.(err);
            return Promise.reject(err);
          },
        };
      },
    },
    isReading() {
      return readStarted;
    },
  };
}

describe("stream-client", () => {
  const testKey = Buffer.alloc(32, 0xab);
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPreview = process.env.VITE_PREVIEW;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.VITE_PREVIEW = originalPreview;
  });

  describe("connectToStream basic event parsing", () => {
    test("parses indexed DELETED event", async () => {
      mockFetch(createMockStream([createBinaryMessage([EventType.ITEM_DELETED, 1234, 11])]));

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
        reconnect: false,
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: EventType.ITEM_DELETED,
        item: 1234,
        index: 11,
      });
    });

    test("parses indexed CHANGED event with full item", async () => {
      const id = 34;
      const content: Block[] = [["p", ["Hello"]]];

      const props = {
        title: "Test",
        tags: [1, new Uint8Array([2])],
        publishedAt: 1700000000,
        createdAt: 1699000000,
      };
      const wireItem = [id, "article", 1700500000, props, content];
      mockFetch(createMockStream([createBinaryMessage([EventType.ITEM_CHANGED, wireItem, 42])]));

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
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
      const itemProps = changedEvent.item.props as Record<string, unknown>;
      expect(itemProps.publishedAt).toBe(1700000000);
      expect(itemProps.createdAt).toBe(1699000000);
      expect(changedEvent.item.changedAt).toBe(1700500000);
      expect(changedEvent.item.content).toEqual(content);
      expect(itemProps.title).toBe("Test");
      expect(Array.isArray(itemProps.tags)).toBe(true);
    });

    test("materializes sparse item patches", async () => {
      const base = [34, "article", 1700500000, { title: "Old", slug: "old" }, [["p", ["Old"]]]];
      const patch = [34, "article", 1700500001, { title: "New", slug: undefined }, []];
      mockFetch(
        createMockStream([
          createBinaryMessage([EventType.ITEM_CHANGED, base, 42]),
          createBinaryMessage([EventType.ITEM_CHANGED, patch, 43]),
        ]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream({ key: testKey, reconnect: false })) {
        events.push(event);
      }

      const changed = events[1] as { item: Record<string, unknown> };
      expect(changed.item.props).toEqual({ title: "New" });
      expect(changed.item.content).toEqual([]);
    });

    test("preserves omitted sparse fields", async () => {
      const base = [34, "article", 1700500000, { title: "Old" }, [["p", ["Old"]]]];
      const patch = [34, "article", 1700500001, { title: "New" }];
      mockFetch(
        createMockStream([
          createBinaryMessage([EventType.ITEM_CHANGED, base, 42]),
          createBinaryMessage([EventType.ITEM_CHANGED, patch, 43]),
        ]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream({ key: testKey, reconnect: false })) {
        events.push(event);
      }

      const changed = events[1] as { item: Record<string, unknown> };
      expect(changed.item.props).toEqual({ title: "New" });
      expect(changed.item.content).toEqual([["p", ["Old"]]]);
    });

    test("ignores non-indexed item events", async () => {
      mockFetch(
        createMockStream([
          createBinaryMessage([EventType.ITEM_DELETED, 1]),
          createBinaryMessage([
            EventType.ITEM_CHANGED,
            [null, null, new Uint8Array([2]), "c", 1, {}],
          ]),
        ]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
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
          createBinaryMessage([EventType.ITEM_DELETED, 1, 7]),
        ]),
      );

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
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
      mockFetch(createMockStream([createBinaryMessage([EventType.ITEM_DELETED, 1, 2])]));

      const events: unknown[] = [];
      for await (const event of connectToStream({
        key: testKey,
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
    test("sends refresh commands with monotonic ids and yields command results", async () => {
      const sockets: MockWebSocket[] = [];
      globalThis.WebSocket = createMockWebSocketClass(sockets) as unknown as typeof WebSocket;

      const client = connectToStream({ key: testKey, reconnect: false });
      const eventsPromise = collectEvents(async () => {
        const events: unknown[] = [];
        for await (const event of client) events.push(event);
        return events;
      });

      await waitFor(() => sockets.length === 1 && sockets[0].ready());
      const first = client.refresh("posts", [1, 2]);
      const second = client.refreshAll("posts");
      expect(sockets[0].sent()).toEqual([
        [ApplicationCommand.REFRESH, 1, "posts", [1, 2]],
        [ApplicationCommand.REFRESH_ALL, 2, "posts"],
      ]);

      sockets[0].emit(pack([CommandResult.REFRESH, 1, RefreshStatus.ACCEPTED, [2]]));
      sockets[0].emit(pack([CommandResult.REFRESH_ALL, 2, RefreshStatus.ACCEPTED]));
      expect(await first).toEqual({
        type: CommandResult.REFRESH,
        commandId: 1,
        status: RefreshStatus.ACCEPTED,
        ignoredItemIds: [2],
      });
      expect(await second).toEqual({
        type: CommandResult.REFRESH_ALL,
        commandId: 2,
        status: RefreshStatus.ACCEPTED,
      });
      sockets[0].close(1000, "done");

      expect(await eventsPromise).toEqual([
        {
          type: CommandResult.REFRESH,
          commandId: 1,
          status: RefreshStatus.ACCEPTED,
          ignoredItemIds: [2],
        },
        { type: CommandResult.REFRESH_ALL, commandId: 2, status: RefreshStatus.ACCEPTED },
      ]);
    });

    test("clears the file lease timeout when sending fails", async () => {
      const sockets: MockWebSocket[] = [];
      const sendError = new Error("send failed");
      globalThis.WebSocket = createMockWebSocketClass(
        sockets,
        sendError,
      ) as unknown as typeof WebSocket;
      const originalSetTimeout = globalThis.setTimeout;
      const originalClearTimeout = globalThis.clearTimeout;
      const createdTimers: Timer[] = [];
      const clearedTimers: Timer[] = [];
      globalThis.setTimeout = ((
        handler: (...args: unknown[]) => void,
        timeout?: number,
        ...args: unknown[]
      ) => {
        const timer = originalSetTimeout(handler, timeout, ...args);
        createdTimers.push(timer);
        return timer;
      }) as typeof setTimeout;
      globalThis.clearTimeout = ((timer: Timer | number | undefined) => {
        if (timer !== undefined) clearedTimers.push(timer as Timer);
        return originalClearTimeout(timer);
      }) as typeof clearTimeout;

      const client = connectToStream({ key: testKey, reconnect: false });
      const next = client.next();
      try {
        await waitFor(() => sockets.length === 1 && sockets[0].ready());
        await expect(client.resolveFileLease!(1, "source", 1, "handle")).rejects.toBe(sendError);
        expect(createdTimers).toHaveLength(1);
        expect(clearedTimers).toEqual([createdTimers[0]]);
      } finally {
        try {
          await client.return(undefined);
          await next;
        } finally {
          globalThis.setTimeout = originalSetTimeout;
          globalThis.clearTimeout = originalClearTimeout;
        }
      }
    });

    test("rejects a pending refresh when the WebSocket disconnects", async () => {
      const sockets: MockWebSocket[] = [];
      globalThis.WebSocket = createMockWebSocketClass(sockets) as unknown as typeof WebSocket;

      const client = connectToStream({ key: testKey, reconnect: false });
      const eventsPromise = collectEvents(async () => {
        for await (const _event of client) {
          // consume the connection until it closes
        }
      });

      await waitFor(() => sockets.length === 1 && sockets[0].ready());
      const refresh = client.refresh("posts", [1]);
      sockets[0].close(1006, "network lost");

      await expect(refresh).rejects.toThrow("Sync command failed: network lost");
      await eventsPromise;
    });

    test("rejects a pending refresh when the consumer cancels the iterator", async () => {
      const sockets: MockWebSocket[] = [];
      globalThis.WebSocket = createMockWebSocketClass(sockets) as unknown as typeof WebSocket;

      const client = connectToStream({ key: testKey, reconnect: true });
      const next = client.next();
      await waitFor(() => sockets.length === 1 && sockets[0].ready());

      const refresh = client.refresh("posts", [1]);
      const cancelled = client.return(undefined);

      await expect(refresh).rejects.toThrow("Sync command failed: Stream consumer stopped");
      await cancelled;
      await next;
    });

    test("rejects a refresh requested from a disconnect event", async () => {
      const sockets: MockWebSocket[] = [];
      globalThis.WebSocket = createMockWebSocketClass(sockets) as unknown as typeof WebSocket;

      const client = connectToStream({ key: testKey, reconnect: false, connectionEvents: true });
      const eventsPromise = collectEvents(async () => {
        for await (const event of client) {
          if (event.type === EventType.STREAM_DISCONNECTED) {
            await expect(client.refresh("posts", [1])).rejects.toThrow(
              "Sync command failed: no active stream connection",
            );
          }
        }
      });

      await waitFor(() => sockets.length === 1 && sockets[0].ready());
      sockets[0].close(1006, "network lost");

      await eventsPromise;
      expect(sockets[0].sent()).toEqual([]);
    });

    test("suppresses yielded command results when commandResults is false", async () => {
      const sockets: MockWebSocket[] = [];
      globalThis.WebSocket = createMockWebSocketClass(sockets) as unknown as typeof WebSocket;

      const client = connectToStream({ key: testKey, reconnect: false, commandResults: false });
      const eventsPromise = collectEvents(async () => {
        const events: unknown[] = [];
        for await (const event of client) events.push(event);
        return events;
      });

      await waitFor(() => sockets.length === 1 && sockets[0].ready());
      const result = client.refresh("posts", [1]);
      sockets[0].emit(pack([CommandResult.REFRESH, 1, RefreshStatus.ACCEPTED]));
      expect(await result).toEqual({
        type: CommandResult.REFRESH,
        commandId: 1,
        status: RefreshStatus.ACCEPTED,
        ignoredItemIds: undefined,
      });
      sockets[0].close(1000, "done");
      expect(await eventsPromise).toEqual([]);
    });

    test("parses binary websocket messages", async () => {
      const sockets: MockWebSocket[] = [];
      globalThis.WebSocket = createMockWebSocketClass(sockets) as unknown as typeof WebSocket;

      const eventsPromise = collectEvents(async () => {
        const events: unknown[] = [];
        for await (const event of connectToStream({
          key: testKey,
          reconnect: false,
          connectionEvents: true,
        })) {
          events.push(event);
        }
        return events;
      });

      await waitFor(() => sockets.length === 1 && sockets[0].ready());
      sockets[0].emit(pack([EventType.ITEM_DELETED, 98, 12]));
      sockets[0].close(1000, "done");

      const events = await eventsPromise;
      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: EventType.STREAM_CONNECTED });
      expect(events[1]).toEqual({
        type: EventType.ITEM_DELETED,
        item: 98,
        index: 12,
      });
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

    test("retries initial HTTP failures by default", async () => {
      globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;
      await withImmediateReconnectDelays(async (delays) => {
        let callCount = 0;
        globalThis.fetch = ((_url: string) => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: false,
              status: 503,
              text: () => Promise.resolve("Unavailable"),
              body: createMockStream([]),
            });
          }

          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(""),
            body: createMockStream([createBinaryMessage([EventType.ITEM_DELETED, 1, 4])]),
          });
        }) as typeof fetch;

        const events: unknown[] = [];
        for await (const event of connectToStream({
          key: testKey,
          connectionEvents: true,
          initialReconnectDelay: 5,
          maxReconnectDelay: 20,
        })) {
          events.push(event);
          if ((event as { type: number }).type === EventType.ITEM_DELETED) break;
        }

        expect(callCount).toBe(2);
        expect(delays).toEqual([5]);
        expect(events[0]).toEqual({
          type: EventType.STREAM_DISCONNECTED,
          reason: "Sync connection failed: 503 Unavailable",
        });
        expect(events[1]).toEqual({ type: EventType.STREAM_CONNECTED });
        expect((events[2] as { type: number }).type).toBe(EventType.ITEM_DELETED);
      });
    });

    test("caps reconnect backoff and resets it after a successful connection", async () => {
      globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;
      await withImmediateReconnectDelays(async (delays) => {
        let callCount = 0;
        globalThis.fetch = ((_url: string) => {
          callCount++;
          if (callCount <= 3) {
            return Promise.resolve({
              ok: false,
              status: 503,
              text: () => Promise.resolve("Unavailable"),
              body: createMockStream([]),
            });
          }

          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(""),
            body: createMockStream(
              callCount === 4 ? [] : [createBinaryMessage([EventType.ITEM_DELETED, 9, 9])],
            ),
          });
        }) as typeof fetch;

        for await (const event of connectToStream({
          key: testKey,
          reconnect: true,
          connectionEvents: true,
          initialReconnectDelay: 5,
          maxReconnectDelay: 20,
        })) {
          if ((event as { type: number }).type === EventType.ITEM_DELETED) break;
        }

        expect(callCount).toBe(5);
        expect(delays).toEqual([5, 10, 20, 5]);
      });
    });

    test("reconnects after a mid-stream disconnect without sending a replay cursor", async () => {
      globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;
      await withImmediateReconnectDelays(async (delays) => {
        const urls: string[] = [];
        let callCount = 0;
        globalThis.fetch = ((url: string) => {
          urls.push(url);
          callCount++;
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(""),
            body: createMockStream([
              createBinaryMessage([EventType.ITEM_DELETED, callCount, callCount === 1 ? 7 : 8]),
            ]),
          });
        }) as typeof fetch;

        const itemIndexes: number[] = [];
        for await (const event of connectToStream({
          key: testKey,
          reconnect: true,
          connectionEvents: true,
          initialReconnectDelay: 5,
          maxReconnectDelay: 20,
        })) {
          if ((event as { type: number }).type !== EventType.ITEM_DELETED) continue;
          itemIndexes.push((event as { index: number }).index);
          if (itemIndexes.length === 2) break;
        }

        expect(itemIndexes).toEqual([7, 8]);
        expect(urls[0]).not.toContain("from=");
        expect(urls[1]).not.toContain("from=");
        expect(delays).toEqual([5]);
      });
    });

    test("closes stalled HTTP streams and reconnects", async () => {
      globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;
      const originalSetInterval = globalThis.setInterval;
      const originalClearInterval = globalThis.clearInterval;
      const originalSetTimeout = globalThis.setTimeout;
      const originalDateNow = Date.now;
      let interval: (() => void) | undefined;
      let now = 1_000;
      const delays: number[] = [];
      let callCount = 0;

      globalThis.setInterval = ((handler: () => void) => {
        interval = handler;
        return 1 as unknown as Timer;
      }) as typeof setInterval;
      globalThis.clearInterval = (() => undefined) as typeof clearInterval;
      globalThis.setTimeout = ((
        handler: (...args: unknown[]) => void,
        timeout?: number,
        ...args: unknown[]
      ) => {
        delays.push(timeout ?? 0);
        queueMicrotask(() => handler(...args));
        return 1 as unknown as Timer;
      }) as typeof setTimeout;
      Date.now = () => now;
      globalThis.fetch = ((_url: string) => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(""),
          body:
            callCount === 1
              ? createStallingBody()
              : createMockStream([createBinaryMessage([EventType.ITEM_DELETED, 1, 1])]),
        });
      }) as typeof fetch;

      const iterator = connectToStream({
        key: testKey,
        reconnect: true,
        connectionEvents: true,
        initialReconnectDelay: 5,
        maxReconnectDelay: 20,
      });

      try {
        expect(await iterator.next()).toEqual({
          value: { type: EventType.STREAM_CONNECTED },
          done: false,
        });

        const disconnected = iterator.next();
        await Promise.resolve();

        now += 46_000;
        interval?.();

        expect(await disconnected).toEqual({
          value: { type: EventType.STREAM_DISCONNECTED, reason: "Stream stalled" },
          done: false,
        });
        expect(await iterator.next()).toEqual({
          value: { type: EventType.STREAM_CONNECTED },
          done: false,
        });

        const item = await iterator.next();
        expect(item.done).toBe(false);
        expect(item.value).toEqual({
          type: EventType.ITEM_DELETED,
          item: 1,
          index: 1,
        });
        expect(callCount).toBe(2);
        expect(delays).toEqual([5]);
      } finally {
        await iterator.return(undefined);
        globalThis.setInterval = originalSetInterval;
        globalThis.clearInterval = originalClearInterval;
        globalThis.setTimeout = originalSetTimeout;
        Date.now = originalDateNow;
      }
    });

    test("swallows expected HTTP stream close rejections when the consumer stops", async () => {
      globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;
      const originalSetInterval = globalThis.setInterval;
      const originalClearInterval = globalThis.clearInterval;
      const originalDateNow = Date.now;
      let interval: (() => void) | undefined;
      let now = 1_000;

      globalThis.setInterval = ((handler: () => void) => {
        interval = handler;
        return 1 as unknown as Timer;
      }) as typeof setInterval;
      globalThis.clearInterval = (() => undefined) as typeof clearInterval;
      Date.now = () => now;
      const stream = createRejectedCloseBody();
      globalThis.fetch = ((_url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(""),
          body: stream.body,
        })) as unknown as typeof fetch;

      const iterator = connectToStream({
        key: testKey,
        reconnect: false,
        connectionEvents: true,
      });

      try {
        expect(await iterator.next()).toEqual({
          value: { type: EventType.STREAM_CONNECTED },
          done: false,
        });

        const disconnected = iterator.next();
        await waitFor(() => stream.isReading());

        now += 46_000;
        interval?.();

        expect(await disconnected).toEqual({
          value: { type: EventType.STREAM_DISCONNECTED, reason: "Stream stalled" },
          done: false,
        });
      } finally {
        await iterator.return(undefined);
        globalThis.setInterval = originalSetInterval;
        globalThis.clearInterval = originalClearInterval;
        Date.now = originalDateNow;
      }
    });
  });

  describe("URL construction", () => {
    test("uses default sync URL when not specified", async () => {
      const { getUrl } = mockFetchCapture([]);

      for await (const _ of connectToStream({ key: testKey, reconnect: false })) {
        // consume
      }

      expect(getUrl()).toBe(`https://contfu.com/api/sync?key=${testKey.toString("base64url")}`);
    });

    test("encodes key as base64url in query parameter", async () => {
      const { getUrls } = mockFetchCapture([]);

      for await (const _ of connectToStream({
        key: testKey,
        reconnect: false,
      })) {
        // consume
      }

      const expectedKey = testKey.toString("base64url");
      const syncUrl = getUrls().find((u) => u.includes("/api/sync?"));
      expect(syncUrl).toBe(`https://contfu.com/api/sync?key=${expectedKey}`);
    });

    test("acks a processed mutation batch without sending sequence progress", async () => {
      const calls: Array<{ url: string; method?: string }> = [];
      globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;

      globalThis.fetch = ((url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method });
        const isAck = init?.method === "POST";
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(""),
          body: isAck
            ? null
            : createMockStream([createBinaryMessage([[EventType.ITEM_DELETED, 1, 7]])]),
        });
      }) as typeof fetch;

      for await (const _ of connectToStream({
        key: testKey,
        reconnect: false,
      })) {
        // consume
      }

      const syncCall = calls.find((call) => call.method == null);
      const ackCall = calls.find((call) => call.method === "POST");

      expect(syncCall?.url).not.toContain("from=");
      expect(ackCall?.url).toContain("/api/sync/ack?");
      expect(ackCall?.url).not.toContain("seq=");
    });
  });

  describe("transport fallback", () => {
    test("uses websocket first when setup succeeds", async () => {
      const sockets: MockWebSocket[] = [];
      globalThis.WebSocket = createMockWebSocketClass(sockets) as unknown as typeof WebSocket;
      const fetchCalls: string[] = [];
      globalThis.fetch = ((url: string) => {
        fetchCalls.push(url);
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(""),
          body: null,
        });
      }) as typeof fetch;

      const eventsPromise = collectEvents(async () => {
        const events: unknown[] = [];
        for await (const event of connectToStream({ key: testKey, reconnect: false })) {
          events.push(event);
        }
        return events;
      });

      await waitFor(() => sockets.length === 1 && sockets[0].ready());
      sockets[0].emit(pack([EventType.ITEM_DELETED, 98, 12]));
      sockets[0].close(1000, "done");

      expect(await eventsPromise).toEqual([{ type: EventType.ITEM_DELETED, item: 98, index: 12 }]);
      expect(sockets[0].url).toContain("wss://contfu.com/api/sync");
      expect(fetchCalls).toEqual([]);
    });

    test("falls back to HTTP when websocket setup fails", async () => {
      globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;
      const { getUrls } = mockFetchCapture([createBinaryMessage([EventType.ITEM_DELETED, 7, 3])]);
      globalThis.WebSocket = createFailingWebSocketClass() as unknown as typeof WebSocket;

      const events: unknown[] = [];
      for await (const event of connectToStream({ key: testKey, reconnect: false })) {
        events.push(event);
      }

      expect(events).toEqual([{ type: EventType.ITEM_DELETED, item: 7, index: 3 }]);
      expect(getUrls()[0]).toContain("https://contfu.com/api/sync");
    });
  });
});

type MockWebSocket = {
  url: string;
  ready: () => boolean;
  emit: (data: Uint8Array) => void;
  sent: () => unknown[];
  close: (code?: number, reason?: string) => void;
};

function createFailingWebSocketClass() {
  return class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    binaryType: "arraybuffer" | "blob" = "blob";
    readyState = 0;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;

    constructor(public readonly url: string) {
      queueMicrotask(() => this.onerror?.({} as Event));
    }

    send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {}
    close(_code = 1000, _reason = "") {}
  };
}

function createMockWebSocketClass(sockets: MockWebSocket[], sendError?: Error) {
  return class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    binaryType: "arraybuffer" | "blob" = "blob";
    readyState = 1;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    private readonly sentMessages: unknown[] = [];

    constructor(public readonly url: string) {
      sockets.push({
        url,
        ready: () => this.onmessage != null && this.onclose != null,
        emit: (data) => {
          this.onmessage?.({
            data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
          } as MessageEvent);
        },
        sent: () => [...this.sentMessages],
        close: (code = 1000, reason = "") => {
          this.readyState = 3;
          this.onclose?.({ code, reason } as CloseEvent);
        },
      });
      queueMicrotask(() => this.onopen?.({} as Event));
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      if (sendError) throw sendError;
      if (typeof data === "string" || data instanceof Blob) return;
      const bytes = ArrayBuffer.isView(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data);
      this.sentMessages.push(unpack(bytes));
    }

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
  return run();
}
