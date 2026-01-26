/**
 * End-to-end integration test for WebSocket server startup.
 *
 * This test verifies the full server startup flow:
 * 1. WebSocketServer is initialized via the startup module
 * 2. SyncWorkerManager is initialized and wired to WebSocketServer
 * 3. Clients can connect and authenticate
 * 4. Invalid authentication is properly rejected
 */
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { CommandType, EventType } from "@contfu/core";
import { pack, unpack } from "msgpackr";

// Test consumer credentials
const TEST_CONSUMER_KEY = Buffer.alloc(24);
TEST_CONSUMER_KEY.write("e2e-consumer-key-123456", 0, 24);

const TEST_CONSUMER = {
  id: 1,
  userId: "e2e-user-1",
  key: TEST_CONSUMER_KEY,
};

// Track the last queried key for authentication tests
let lastQueriedKey: Buffer | null = null;

// Create chainable mock for db that tracks key queries
function createKeyTrackingChainableMock() {
  const chain: any = {};
  const methods = ["select", "from", "limit", "groupBy", "orderBy", "innerJoin", "set", "update"];

  for (const method of methods) {
    chain[method] = () => chain;
  }

  chain.where = () => chain;

  chain.all = () => {
    // Check if the last queried key matches TEST_CONSUMER_KEY
    if (lastQueriedKey && lastQueriedKey.toString("hex") !== TEST_CONSUMER_KEY.toString("hex")) {
      return Promise.resolve([]);
    }
    return Promise.resolve([TEST_CONSUMER]);
  };

  chain.then = (resolve: any) => chain.all().then(resolve);

  return chain;
}

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

// Mock database - must be before imports
mock.module("../db/db", () => {
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
                userId: "e2e-user-1",
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
      key: {},
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

// Mock SyncWorkerManager to avoid spawning actual workers
mock.module("../sync-worker/worker-manager", () => ({
  SyncWorkerManager: class MockSyncWorkerManager {
    private itemsCallback: ((items: any[], connections: any[]) => void) | null = null;

    async start() {
      // No-op for testing
    }

    async stop() {
      // No-op for testing
    }

    onItems(callback: (items: any[], connections: any[]) => void) {
      this.itemsCallback = callback;
    }

    async activateConsumer(_userId: string, _consumerId: number) {
      // No-op for testing
    }

    deactivateConsumer(_userId: string, _consumerId: number) {
      // No-op for testing
    }

    // For testing: trigger item broadcast
    triggerItems(items: any[], connections: any[]) {
      this.itemsCallback?.(items, connections);
    }
  },
}));

// Dynamic import after mocks
const { getWebSocketServer, initialize, shutdown, isServerInitialized, getWebSocketHandler } =
  await import("../startup");

type ConnectionInfo = {
  userId: string;
  consumerId: number;
  collectionId: number;
  lastItemChanged: number | null;
};

describe("E2E: WebSocket Server Startup", () => {
  let server: ReturnType<typeof Bun.serve>;
  let PORT: number;

  beforeAll(async () => {
    // Find an available port
    PORT = 10000 + Math.floor(Math.random() * 50000);

    // Initialize the startup module (this creates WebSocketServer and SyncWorkerManager singletons)
    await initialize();

    // Get the WebSocket handler from the startup module
    const wsHandler = getWebSocketHandler();

    // Create a test server using the actual WebSocket handler
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
      websocket: wsHandler,
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (server) {
      server.stop();
    }
    await shutdown();
  });

  describe("Server Initialization", () => {
    it("should have initialized the server startup module", () => {
      expect(isServerInitialized()).toBe(true);
    });

    it("should have created WebSocketServer singleton", () => {
      const wsServer = getWebSocketServer();
      expect(wsServer).toBeDefined();
      expect(typeof wsServer.createHandler).toBe("function");
      expect(typeof wsServer.setWorker).toBe("function");
      expect(typeof wsServer.broadcast).toBe("function");
    });

    it("should have WebSocket handler with required methods", () => {
      const handler = getWebSocketHandler();
      expect(handler).toBeDefined();
      expect(typeof handler.open).toBe("function");
      expect(typeof handler.message).toBe("function");
      expect(typeof handler.close).toBe("function");
    });
  });

  describe("Client Connection", () => {
    it("should accept WebSocket upgrade at /ws endpoint", async () => {
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

      const opened = await new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          resolve(true);
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });

      ws.close();
      expect(opened).toBe(true);
    });

    it("should connect and authenticate with valid consumer key", async () => {
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

    it("should reject authentication with invalid consumer key", async () => {
      lastQueriedKey = null; // Reset
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
      const invalidKey = Buffer.alloc(24);
      invalidKey.write("invalid-key-for-e2e-tst", 0, 24);

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
      const shortKey = Buffer.alloc(10); // Wrong length (should be 24)

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

    it("should return E_INVALID for malformed messages", async () => {
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

      const result = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

        ws.onopen = () => {
          // Send invalid/malformed data
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
  });

  describe("ACK Command Handling", () => {
    it("should accept ACK command after authentication", async () => {
      lastQueriedKey = null; // Reset
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

      // First, connect and authenticate
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

    it("should reject ACK command before authentication", async () => {
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

      const result = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

        ws.onopen = () => {
          // Send ACK without authenticating first
          const itemId = Buffer.alloc(16);
          const ackCmd = pack([CommandType.ACK, itemId]);
          ws.send(ackCmd);
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
      expect(result).toBe("E_ACCESS");
    });
  });

  describe("Item Broadcasting", () => {
    it("should broadcast items to authenticated consumers", async () => {
      lastQueriedKey = null; // Reset
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

      // First, connect and authenticate
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

      // Get the WebSocket server and broadcast an item
      const wsServer = getWebSocketServer();
      const testItem = {
        user: "e2e-user-1",
        collection: 1,
        id: Buffer.alloc(16),
        ref: Buffer.from("test-ref"),
        props: { title: "E2E Test Item" },
        content: [],
        createdAt: 1000,
        changedAt: 2000,
      };

      const connections: ConnectionInfo[] = [
        {
          userId: "e2e-user-1",
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
      expect(receivedItem.item.collection).toBe(1);
      expect(receivedItem.item.createdAt).toBe(1000);
      expect(receivedItem.item.changedAt).toBe(2000);
      expect(receivedItem.item.props).toEqual({ title: "E2E Test Item" });
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
      const wsServer = getWebSocketServer();
      const oldItem = {
        user: "e2e-user-1",
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
          userId: "e2e-user-1",
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
  });

  describe("Multiple Connections", () => {
    it("should handle multiple concurrent client connections", async () => {
      lastQueriedKey = null; // Reset

      // Create multiple WebSocket connections
      const connections: WebSocket[] = [];
      const results: boolean[] = [];

      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
        connections.push(ws);

        // Note: All connections will use the same test key, so only the first
        // will succeed due to E_CONFLICT protection. This tests that the server
        // handles multiple simultaneous connection attempts gracefully.
        const result = await new Promise<boolean>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

          ws.onopen = () => {
            const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
            ws.send(connectCmd);
          };

          ws.onmessage = (event) => {
            clearTimeout(timeout);
            const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
            if (data[0] === EventType.CONNECTED) {
              resolve(true);
            } else if (data[0] === EventType.ERROR) {
              // E_CONFLICT is expected for subsequent connections with same key
              resolve(false);
            }
          };

          ws.onerror = (error) => {
            clearTimeout(timeout);
            reject(error);
          };
        });

        results.push(result);

        // Close the connection if it was successful to allow next one
        if (result) {
          ws.close();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Clean up any remaining connections
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }

      // At least one connection should have succeeded
      expect(results.filter((r) => r).length).toBeGreaterThanOrEqual(1);
    });
  });
});
