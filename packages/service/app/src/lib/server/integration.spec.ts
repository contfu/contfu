import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { CommandType, EventType, type ItemEvent } from "@contfu/core";
import { pack, unpack } from "msgpackr";

// Test consumer credentials
const TEST_CONSUMER_KEY = Buffer.alloc(32);
TEST_CONSUMER_KEY.write("test-consumer-key-1234567890123", 0, 32);

const TEST_CONSUMER_KEY_2 = Buffer.alloc(32);
TEST_CONSUMER_KEY_2.write("test-consumer-key-2234567890123", 0, 32);

const TEST_CONSUMER_KEY_3 = Buffer.alloc(32);
TEST_CONSUMER_KEY_3.write("test-consumer-key-3234567890123", 0, 32);

const TEST_CONSUMER = {
  id: 1,
  userId: "user-1",
  key: TEST_CONSUMER_KEY,
};

const TEST_CONSUMER_2 = {
  id: 2,
  userId: "user-1",
  key: TEST_CONSUMER_KEY_2,
};

const TEST_CONSUMER_3 = {
  id: 3,
  userId: "user-1",
  key: TEST_CONSUMER_KEY_3,
};

// Create chainable mock for db
function createChainableMock(finalResult: any) {
  const chain: any = {};
  const methods = [
    "select",
    "from",
    "where",
    "limit",
    "all",
    "groupBy",
    "orderBy",
    "innerJoin",
    "set",
    "update",
  ];
  for (const method of methods) {
    chain[method] = () => chain;
  }
  chain.all = () => Promise.resolve(finalResult);
  chain.then = (resolve: any) => Promise.resolve(finalResult).then(resolve);
  return () => chain;
}

// Track the last queried key
let lastQueriedKey: Buffer | null = null;

// Create chainable mock for db that tracks key queries
function createKeyTrackingChainableMock() {
  const chain: any = {};
  const methods = ["select", "from", "limit", "groupBy", "orderBy", "innerJoin", "set", "update"];

  for (const method of methods) {
    chain[method] = () => chain;
  }

  chain.where = (condition: any) => {
    // Extract key from the condition created by eq()
    // The condition has shape { column, value } from our eq mock
    if (condition?.value instanceof Buffer) {
      chain._queriedKey = condition.value;
    }
    return chain;
  };

  chain.all = () => {
    // Use the key captured from this chain's where clause, or fall back to lastQueriedKey
    const key = chain._queriedKey || lastQueriedKey;
    if (!key) {
      return Promise.resolve([TEST_CONSUMER]);
    }
    const keyHex = key.toString("hex");
    if (keyHex === TEST_CONSUMER_KEY.toString("hex")) {
      return Promise.resolve([TEST_CONSUMER]);
    }
    if (keyHex === TEST_CONSUMER_KEY_2.toString("hex")) {
      return Promise.resolve([TEST_CONSUMER_2]);
    }
    if (keyHex === TEST_CONSUMER_KEY_3.toString("hex")) {
      return Promise.resolve([TEST_CONSUMER_3]);
    }
    return Promise.resolve([]);
  };

  chain.then = (resolve: any) => chain.all().then(resolve);

  return chain;
}

// Mock database - must be before imports
mock.module("./db/db", () => {
  return {
    db: {
      $count: mock(() => Promise.resolve(1)),
      select: () => createKeyTrackingChainableMock(),
      update: createChainableMock(undefined),
      query: {
        connection: {
          findMany: mock(() =>
            Promise.resolve([
              {
                userId: "user-1",
                consumerId: 1,
                collectionId: 1,
                lastItemChanged: null,
              },
            ]),
          ),
        },
      },
    },
    consumerTable: {
      key: {
        // This is a hack to track the key being queried
        // When drizzle creates the condition, it may access this property
      },
    },
    collectionTable: {
      userId: "userId",
      id: "id",
      itemIds: "itemIds",
      sourceId: "sourceId",
      ref: "ref",
    },
    connectionTable: {
      userId: "userId",
      consumerId: "consumerId",
      collectionId: "collectionId",
      lastItemChanged: "lastItemChanged",
    },
    sourceTable: {
      userId: "userId",
      id: "id",
      type: "type",
      url: "url",
      credentials: "credentials",
    },
  };
});

// Mock drizzle-orm's eq function to track key queries
mock.module("drizzle-orm", () => ({
  eq: (column: any, value: any) => {
    if (value instanceof Buffer && value.length === 32) {
      lastQueriedKey = value;
    }
    return { column, value };
  },
  and: (...conditions: any[]) => conditions,
  asc: (column: any) => column,
  inArray: (column: any, values: any[]) => ({ column, values }),
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
}));

// Dynamic import after mock
const { WebSocketServer } = await import("./websocket/ws-server");
const { SSEServer } = await import("./sse/sse-server");
type ConnectionInfo = {
  userId: string;
  consumerId: number;
  collectionId: number;
  lastItemChanged: number | null;
};

describe("Integration: WebSocket Server", () => {
  let server: ReturnType<typeof Bun.serve>;
  let wsServer: InstanceType<typeof WebSocketServer>;
  let PORT: number;

  beforeAll(async () => {
    wsServer = new WebSocketServer();

    // Create a mock worker manager
    const mockWorkerManager = {
      activateConsumer: mock(() => Promise.resolve()),
      deactivateConsumer: mock(() => {}),
    };
    wsServer.setWorker(mockWorkerManager as any);

    // Find an available port
    PORT = 10000 + Math.floor(Math.random() * 50000);

    server = Bun.serve({
      port: PORT,
      fetch(request, server) {
        const url = new URL(request.url);
        if (url.pathname === "/ws" || url.pathname === "/") {
          if (server.upgrade(request, { data: { id: "" } })) {
            return undefined as any;
          }
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return new Response("Not found", { status: 404 });
      },
      websocket: wsServer.createHandler(),
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    if (server) {
      server.stop();
    }
  });

  it("should connect and authenticate with valid key", async () => {
    lastQueriedKey = null; // Reset
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

    const connected = await new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        // Send CONNECT command with valid key
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) {
          resolve(true);
        } else if (data[0] === EventType.ERROR) {
          resolve(false);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(connected).toBe(true);
  });

  it("should reject authentication with invalid key", async () => {
    lastQueriedKey = null; // Reset
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const invalidKey = Buffer.alloc(24);
    invalidKey.write("invalid-key-000000000", 0, 24);

    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, invalidKey]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.ERROR) {
          resolve(data[1] as string);
        } else if (data[0] === EventType.CONNECTED) {
          resolve("connected");
        } else {
          resolve("unexpected");
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(result).toBe("E_AUTH");
  });

  it("should reject authentication with wrong key length", async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const shortKey = Buffer.alloc(10); // Wrong length

    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, shortKey]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.ERROR) {
          resolve(data[1] as string);
        } else {
          resolve("unexpected");
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(result).toBe("E_AUTH");
  });

  it("should send error for invalid message format", async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        // Send invalid data
        ws.send(new Uint8Array([0xff, 0xff, 0xff]));
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.ERROR) {
          resolve(data[1] as string);
        } else {
          resolve("unexpected");
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(result).toBe("E_INVALID");
  });

  it("should broadcast items to connected consumers", async () => {
    lastQueriedKey = null; // Reset
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

    // First connect and authenticate
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) {
          resolve();
        } else {
          reject(new Error(`Expected CONNECTED, got ${data[0]}`));
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Now broadcast an item
    const testItem = {
      user: "user-1",
      collection: 1,
      id: Buffer.alloc(16),
      ref: Buffer.from("test-ref"),
      props: { title: "Test Item" },
      content: [],
      createdAt: 1000,
      changedAt: 2000,
    };

    const connections: ConnectionInfo[] = [
      {
        userId: "user-1",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    // Broadcast the item
    await wsServer.broadcast([testItem] as any, connections);

    // Receive the item
    const receivedItem = await new Promise<{
      type: typeof EventType.CHANGED;
      item: {
        collection: number;
        id: Buffer;
        createdAt: number;
        changedAt: number;
        ref: unknown;
        props: Record<string, unknown>;
      };
    }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Broadcast timeout")), 5000);

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CHANGED) {
          resolve({
            type: EventType.CHANGED,
            item: {
              collection: data[1] as number,
              id: Buffer.from(data[2] as Uint8Array),
              createdAt: data[3] as number,
              changedAt: data[4] as number,
              ref: (data[5] as unknown[])[0],
              props: (data[5] as unknown[])[1] as Record<string, unknown>,
            },
          });
        } else {
          reject(new Error(`Expected CHANGED event, got ${data[0]}`));
        }
      };
    });

    ws.close();

    expect(receivedItem.type).toBe(EventType.CHANGED);
    if (receivedItem.type === EventType.CHANGED) {
      expect(receivedItem.item.collection).toBe(1);
      expect(receivedItem.item.createdAt).toBe(1000);
      expect(receivedItem.item.changedAt).toBe(2000);
      expect(receivedItem.item.props).toEqual({ title: "Test Item" });
    }
  });

  it("should filter items by lastItemChanged", async () => {
    lastQueriedKey = null; // Reset
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

    // Connect and authenticate
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) {
          resolve();
        } else {
          reject(new Error(`Expected CONNECTED, got ${data[0]}`));
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Broadcast an old item (changedAt < lastItemChanged)
    const oldItem = {
      user: "user-1",
      collection: 1,
      id: Buffer.alloc(16),
      ref: Buffer.from("old-ref"),
      props: {},
      content: [],
      createdAt: 500,
      changedAt: 1000,
    };

    const connections: ConnectionInfo[] = [
      {
        userId: "user-1",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: 2000, // Item changed at 1000, so it should be filtered
      },
    ];

    // Broadcast the old item - it should be filtered
    await wsServer.broadcast([oldItem] as any, connections);

    // Check that no message was received (with a short timeout)
    const receivedMessage = await Promise.race([
      new Promise<boolean>((resolve) => {
        ws.onmessage = () => resolve(true);
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);

    ws.close();
    expect(receivedMessage).toBe(false);
  });

  it("should handle ACK command after authentication", async () => {
    lastQueriedKey = null; // Reset
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

    // Connect and authenticate
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) {
          resolve();
        } else {
          reject(new Error(`Expected CONNECTED, got ${data[0]}`));
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Send ACK command (should not cause error)
    const itemId = Buffer.alloc(16);
    const ackCmd = pack([CommandType.ACK, itemId]);
    ws.send(ackCmd);

    // Wait a bit to ensure no error is sent back
    const receivedError = await Promise.race([
      new Promise<boolean>((resolve) => {
        ws.onmessage = (event) => {
          const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
          if (data[0] === EventType.ERROR) {
            resolve(true);
          }
        };
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);

    ws.close();
    expect(receivedError).toBe(false);
  });
});

describe("Integration: SSE Server", () => {
  let server: ReturnType<typeof Bun.serve>;
  let sseServer: InstanceType<typeof SSEServer>;
  let PORT: number;

  beforeAll(async () => {
    sseServer = new SSEServer();

    // Create a mock worker manager
    const mockWorkerManager = {
      activateConsumer: mock(() => Promise.resolve()),
      deactivateConsumer: mock(() => {}),
    };
    sseServer.setWorker(mockWorkerManager as any);

    // Find an available port
    PORT = 10000 + Math.floor(Math.random() * 50000);

    server = Bun.serve({
      port: PORT,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/sse" || url.pathname === "/api/sse") {
          // Extract consumer key from query param
          let keyString = url.searchParams.get("key");
          if (!keyString) {
            return new Response("Missing authentication key", { status: 401 });
          }

          // Decode the key from base64
          let key: Buffer;
          try {
            key = Buffer.from(keyString, "base64");
            if (key.length !== 32) {
              return new Response("Invalid key format", { status: 401 });
            }
          } catch {
            return new Response("Invalid key encoding", { status: 401 });
          }

          // Create SSE stream
          const stream = new ReadableStream({
            async start(controller) {
              let connectionId: string | null = null;
              let keepAlive: ReturnType<typeof setInterval> | null = null;

              const cleanup = () => {
                if (keepAlive) {
                  clearInterval(keepAlive);
                  keepAlive = null;
                }
                if (connectionId) {
                  sseServer.removeConnection(connectionId);
                  connectionId = null;
                }
                try {
                  controller.close();
                } catch {
                  // Controller may already be closed
                }
              };

              const onAbort = () => {
                cleanup();
              };
              request.signal.addEventListener("abort", onAbort, { once: true });

              if (request.signal.aborted) {
                cleanup();
                return;
              }

              const result = await sseServer.addConnection(key, controller);

              if (request.signal.aborted) {
                cleanup();
                return;
              }

              if (typeof result !== "string") {
                const encoder = new TextEncoder();
                const errorEvent = `event: error\ndata: ${JSON.stringify({ type: "error", code: result.code })}\n\n`;
                controller.enqueue(encoder.encode(errorEvent));
                controller.close();
                request.signal.removeEventListener("abort", onAbort);
                return;
              }

              connectionId = result;
            },
            cancel() {
              // Stream cancelled
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            },
          });
        }
        return new Response("Not found", { status: 404 });
      },
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    if (server) {
      server.stop();
    }
  });

  it("SSE full flow: connect, authenticate, receive CONNECTED, broadcast item, receive CHANGED", async () => {
    lastQueriedKey = null; // Reset

    const keyBase64 = TEST_CONSUMER_KEY.toString("base64");
    const url = `http://localhost:${PORT}/sse?key=${encodeURIComponent(keyBase64)}`;

    // Use fetch with streaming to test SSE
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Helper to read SSE events
    const readEvent = async (): Promise<{ event: string; data: any } | null> => {
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) return null;

        buffer += decoder.decode(value, { stream: true });

        // Check if we have a complete event (ends with \n\n)
        const eventEndIndex = buffer.indexOf("\n\n");
        if (eventEndIndex !== -1) {
          const eventText = buffer.slice(0, eventEndIndex);
          buffer = buffer.slice(eventEndIndex + 2);

          // Parse event
          const lines = eventText.split("\n");
          let eventName = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7);
            } else if (line.startsWith("data: ")) {
              data = line.slice(6);
            }
          }

          if (data) {
            return { event: eventName, data: JSON.parse(data) };
          }
        }
      }
    };

    // Step 1: Receive CONNECTED event
    const connectedEvent = await readEvent();
    expect(connectedEvent).not.toBeNull();
    expect(connectedEvent!.event).toBe("connected");
    expect(connectedEvent!.data.type).toBe(EventType.CONNECTED);

    // Step 2: Broadcast an item
    const testItem = {
      user: "user-1",
      collection: 1,
      id: Buffer.alloc(16),
      ref: Buffer.from("test-ref-sse"),
      props: { title: "SSE Test Item" },
      content: [],
      createdAt: 1000,
      changedAt: 2000,
      publishedAt: 1500,
    };

    const connections: ConnectionInfo[] = [
      {
        userId: "user-1",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    // Broadcast the item
    await sseServer.broadcast([testItem] as any, connections);

    // Step 3: Receive CHANGED event
    const changedEvent = await readEvent();
    expect(changedEvent).not.toBeNull();
    expect(changedEvent!.event).toBe("changed");
    expect(changedEvent!.data.type).toBe(EventType.CHANGED);
    expect(changedEvent!.data.item.collection).toBe(1);
    expect(changedEvent!.data.item.createdAt).toBe(1000);
    expect(changedEvent!.data.item.changedAt).toBe(2000);
    expect(changedEvent!.data.item.publishedAt).toBe(1500);
    expect(changedEvent!.data.item.props).toEqual({ title: "SSE Test Item" });
    expect(changedEvent!.data.item.ref).toBe(testItem.ref.toString("base64"));
    expect(changedEvent!.data.item.id).toBe(testItem.id.toString("base64"));

    // Step 4: Close connection cleanly
    await reader.cancel();
  });

  // TODO: Fix test isolation - module-level SSE connection maps cause race conditions between tests
  it.skip("should handle concurrent SSE connections with independent event streams", async () => {
    lastQueriedKey = null; // Reset

    // Use two different consumer keys for concurrent connections (keys 2 and 3 to avoid conflict with previous tests)
    const keyBase64_1 = TEST_CONSUMER_KEY_2.toString("base64");
    const keyBase64_2 = TEST_CONSUMER_KEY_3.toString("base64");
    const url1 = `http://localhost:${PORT}/sse?key=${encodeURIComponent(keyBase64_1)}`;
    const url2 = `http://localhost:${PORT}/sse?key=${encodeURIComponent(keyBase64_2)}`;

    // Helper to read SSE events
    const createEventReader = (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const decoder = new TextDecoder();
      return async (): Promise<{ event: string; data: any } | null> => {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) return null;

          buffer += decoder.decode(value, { stream: true });

          // Check if we have a complete event (ends with \n\n)
          const eventEndIndex = buffer.indexOf("\n\n");
          if (eventEndIndex !== -1) {
            const eventText = buffer.slice(0, eventEndIndex);
            buffer = buffer.slice(eventEndIndex + 2);

            // Parse event
            const lines = eventText.split("\n");
            let eventName = "";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventName = line.slice(7);
              } else if (line.startsWith("data: ")) {
                data = line.slice(6);
              }
            }

            if (data) {
              return { event: eventName, data: JSON.parse(data) };
            }
          }
        }
      };
    };

    // Create two concurrent SSE connections with different consumer keys
    const response1 = await fetch(url1);
    const response2 = await fetch(url2);

    expect(response1.ok).toBe(true);
    expect(response2.ok).toBe(true);

    const reader1 = response1.body!.getReader();
    const reader2 = response2.body!.getReader();

    const readEvent1 = createEventReader(reader1);
    const readEvent2 = createEventReader(reader2);

    // Both connections should receive CONNECTED events independently
    const [connected1, connected2] = await Promise.all([readEvent1(), readEvent2()]);

    expect(connected1).not.toBeNull();
    expect(connected1!.event).toBe("connected");
    expect(connected1!.data.type).toBe(EventType.CONNECTED);

    expect(connected2).not.toBeNull();
    expect(connected2!.event).toBe("connected");
    expect(connected2!.data.type).toBe(EventType.CONNECTED);

    // Broadcast two different items
    const testItem1 = {
      user: "user-1",
      collection: 1,
      id: Buffer.alloc(16),
      ref: Buffer.from("concurrent-test-1"),
      props: { title: "Concurrent Item 1" },
      content: [],
      createdAt: 1000,
      changedAt: 2000,
      publishedAt: 1500,
    };

    const testItem2 = {
      user: "user-1",
      collection: 1,
      id: Buffer.alloc(16),
      ref: Buffer.from("concurrent-test-2"),
      props: { title: "Concurrent Item 2" },
      content: [],
      createdAt: 1100,
      changedAt: 2100,
      publishedAt: 1600,
    };

    const connections: ConnectionInfo[] = [
      {
        userId: "user-1",
        consumerId: 2,
        collectionId: 1,
        lastItemChanged: null,
      },
      {
        userId: "user-1",
        consumerId: 3,
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    // Broadcast items sequentially
    await sseServer.broadcast([testItem1] as any, connections);
    await sseServer.broadcast([testItem2] as any, connections);

    // Both connections should receive both items independently
    const [changed1_1, changed2_1] = await Promise.all([readEvent1(), readEvent2()]);

    // Verify first item received on both connections
    expect(changed1_1).not.toBeNull();
    expect(changed1_1!.event).toBe("changed");
    expect(changed1_1!.data.item.props.title).toBe("Concurrent Item 1");

    expect(changed2_1).not.toBeNull();
    expect(changed2_1!.event).toBe("changed");
    expect(changed2_1!.data.item.props.title).toBe("Concurrent Item 1");

    // Receive second item on both connections
    const [changed1_2, changed2_2] = await Promise.all([readEvent1(), readEvent2()]);

    expect(changed1_2).not.toBeNull();
    expect(changed1_2!.event).toBe("changed");
    expect(changed1_2!.data.item.props.title).toBe("Concurrent Item 2");

    expect(changed2_2).not.toBeNull();
    expect(changed2_2!.event).toBe("changed");
    expect(changed2_2!.data.item.props.title).toBe("Concurrent Item 2");

    // Close first connection
    await reader1.cancel();

    // Broadcast another item - only second connection should receive it
    const testItem3 = {
      user: "user-1",
      collection: 1,
      id: Buffer.alloc(16),
      ref: Buffer.from("concurrent-test-3"),
      props: { title: "Concurrent Item 3" },
      content: [],
      createdAt: 1200,
      changedAt: 2200,
      publishedAt: 1700,
    };

    await sseServer.broadcast([testItem3] as any, connections);

    // Only second connection should receive this item
    const changed2_3 = await readEvent2();
    expect(changed2_3).not.toBeNull();
    expect(changed2_3!.event).toBe("changed");
    expect(changed2_3!.data.item.props.title).toBe("Concurrent Item 3");

    // Close second connection
    await reader2.cancel();
  });
});
