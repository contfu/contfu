import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { CommandType, EventType } from "@contfu/core";
import { pack, unpack } from "msgpackr";
import { connectTo } from "./client";

// Test consumer credentials
const TEST_CONSUMER_KEY = Buffer.alloc(24);
TEST_CONSUMER_KEY.write("test-consumer-key-12345", 0, 24);

type WsData = { id: string; authenticated: boolean; consumerKey: string | null };

// Minimal WebSocket server that speaks the contfu protocol
// This allows us to test the client without depending on @contfu/svc-app
function createTestWebSocketServer(port: number) {
  const connectedSockets = new Map<
    string,
    { ws: { send: (data: Buffer) => void }; data: WsData }
  >();

  const server = Bun.serve({
    port,
    fetch(request, server) {
      const url = new URL(request.url);
      if (url.pathname === "/ws" || url.pathname === "/") {
        if (
          server.upgrade(request, { data: { id: "", authenticated: false, consumerKey: null } })
        ) {
          return undefined as unknown as Response;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws: { data: WsData }) {
        ws.data = {
          id: crypto.randomUUID(),
          authenticated: false,
          consumerKey: null,
        };
      },
      message(ws: { data: WsData; send: (data: Buffer) => void }, message: Buffer) {
        try {
          const arr = unpack(message) as unknown[];
          if (!Array.isArray(arr) || arr.length < 1) {
            ws.send(pack([EventType.ERROR, "E_INVALID"]));
            return;
          }

          const type = arr[0] as CommandType;

          switch (type) {
            case CommandType.CONNECT: {
              if (arr.length < 2 || !(arr[1] instanceof Uint8Array)) {
                ws.send(pack([EventType.ERROR, "E_INVALID"]));
                return;
              }
              const key = Buffer.from(arr[1]);
              if (key.length !== 24) {
                ws.send(pack([EventType.ERROR, "E_AUTH"]));
                return;
              }
              // Check if key matches test key
              if (key.toString("hex") !== TEST_CONSUMER_KEY.toString("hex")) {
                ws.send(pack([EventType.ERROR, "E_AUTH"]));
                return;
              }
              // Authentication successful
              ws.data.authenticated = true;
              ws.data.consumerKey = key.toString("hex");
              connectedSockets.set(ws.data.id, { ws, data: ws.data });
              ws.send(pack([EventType.CONNECTED]));
              break;
            }
            case CommandType.ACK: {
              if (!ws.data.authenticated) {
                ws.send(pack([EventType.ERROR, "E_ACCESS"]));
                return;
              }
              // ACK received - no response needed
              break;
            }
            default:
              ws.send(pack([EventType.ERROR, "E_INVALID"]));
          }
        } catch {
          ws.send(pack([EventType.ERROR, "E_INVALID"]));
        }
      },
      close(ws: { data: WsData }) {
        if (ws.data.id) {
          connectedSockets.delete(ws.data.id);
        }
      },
    },
  });

  return {
    server,
    // Broadcast a CHANGED event to all authenticated clients
    broadcast(item: {
      collection: number;
      id: Buffer;
      ref: Buffer;
      props: Record<string, unknown>;
      content?: unknown[];
      createdAt: number;
      changedAt: number;
    }) {
      const contentArray =
        item.content && item.content.length > 0
          ? [item.ref, item.props, item.content]
          : [item.ref, item.props];
      const packed = pack([
        EventType.CHANGED,
        item.collection,
        item.id,
        item.createdAt,
        item.changedAt,
        contentArray,
      ]);
      for (const { ws, data } of connectedSockets.values()) {
        if (data.authenticated) {
          ws.send(packed);
        }
      }
    },
    // Send a DELETED event to all authenticated clients
    sendDeleted(itemId: Buffer) {
      const packed = pack([EventType.DELETED, itemId]);
      for (const { ws, data } of connectedSockets.values()) {
        if (data.authenticated) {
          ws.send(packed);
        }
      }
    },
    // Send a LIST_IDS event to all authenticated clients
    sendListIds(collection: number, ids: Buffer[]) {
      const packed = pack([EventType.LIST_IDS, collection, ...ids]);
      for (const { ws, data } of connectedSockets.values()) {
        if (data.authenticated) {
          ws.send(packed);
        }
      }
    },
    // Send a CHECKSUM event to all authenticated clients
    sendChecksum(collection: number, checksum: Buffer) {
      const packed = pack([EventType.CHECKSUM, collection, checksum]);
      for (const { ws, data } of connectedSockets.values()) {
        if (data.authenticated) {
          ws.send(packed);
        }
      }
    },
  };
}

describe("Integration: Client WebSocket", () => {
  let testServer: ReturnType<typeof createTestWebSocketServer>;
  let PORT: number;

  beforeAll(async () => {
    // Find an available port
    PORT = 10000 + Math.floor(Math.random() * 50000);
    testServer = createTestWebSocketServer(PORT);

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(() => {
    if (testServer?.server) {
      testServer.server.stop();
    }
  });

  it("should connect and authenticate with valid key using raw WebSocket", async () => {
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

  it("should connect and authenticate with valid key using connectTo", async () => {
    const events = await connectTo(TEST_CONSUMER_KEY, {
      url: `ws://localhost:${PORT}/ws`,
    });

    // connectTo returns an AsyncGenerator that yields events after connection
    // If we get here without throwing, the connection was successful
    expect(events).toBeDefined();
    expect(typeof events[Symbol.asyncIterator]).toBe("function");
  });

  it("should reject authentication with invalid key", async () => {
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

  it("async generator interface receives CHANGED events via for-await iteration", async () => {
    const events = await connectTo(TEST_CONSUMER_KEY, {
      url: `ws://localhost:${PORT}/ws`,
    });

    // Create test item data
    const testItemId = Buffer.alloc(16);
    testItemId.write("test-item-id-001", 0, 16);
    const testRef = Buffer.alloc(16);
    testRef.write("test-ref-0000001", 0, 16);

    const testItem = {
      collection: 1,
      id: testItemId,
      ref: testRef,
      props: { title: "Test Item", status: "published" },
      content: [{ type: "paragraph", text: "Hello world" }],
      createdAt: Date.now(),
      changedAt: Date.now(),
    };

    // Broadcast event after a short delay to allow the iterator to start waiting
    setTimeout(() => {
      testServer.broadcast(testItem);
    }, 50);

    // Receive the CHANGED event via for-await iteration
    let receivedEvent: unknown = null;
    for await (const event of events) {
      if (event.type === EventType.CHANGED) {
        receivedEvent = event;
        break; // Only get first event
      }
    }

    // Verify the received event
    expect(receivedEvent).not.toBeNull();
    expect((receivedEvent as any).type).toBe(EventType.CHANGED);
    expect((receivedEvent as any).item).toBeDefined();
    expect((receivedEvent as any).item.collection).toBe(1);
    expect((receivedEvent as any).item.props.title).toBe("Test Item");
    expect((receivedEvent as any).item.props.status).toBe("published");
    expect((receivedEvent as any).item.content).toEqual([{ type: "paragraph", text: "Hello world" }]);
  });
});
