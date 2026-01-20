import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { CommandType, EventType, type ItemEvent } from "@contfu/core";
import { pack, unpack } from "msgpackr";

// Test consumer credentials
const TEST_CONSUMER_KEY = Buffer.alloc(24);
TEST_CONSUMER_KEY.write("test-consumer-key-12345", 0, 24);

const TEST_CONSUMER = {
  id: 1,
  userId: "user-1",
  key: TEST_CONSUMER_KEY,
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
    // Try to extract key from the condition if possible
    // The condition is created by drizzle's eq function, which we can't easily inspect
    // So we use a workaround: check the key in the result callback
    return chain;
  };

  chain.all = () => {
    // Check if the last queried key matches TEST_CONSUMER_KEY
    // We'll rely on the key being set via intercepted calls
    if (lastQueriedKey && lastQueriedKey.toString("hex") !== TEST_CONSUMER_KEY.toString("hex")) {
      return Promise.resolve([]);
    }
    return Promise.resolve([TEST_CONSUMER]);
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
    if (value instanceof Buffer && value.length === 24) {
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
