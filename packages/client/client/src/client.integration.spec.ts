import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { CommandType, EventType } from "@contfu/core";
import type { ChangedEvent, ChecksumEvent, DeletedEvent, ListIdsEvent } from "@contfu/core";
import { pack, unpack } from "msgpackr";
import { connectTo } from "./client";

// Test consumer credentials
const TEST_CONSUMER_KEY = Buffer.alloc(24);
TEST_CONSUMER_KEY.write("test-consumer-key-12345", 0, 24);

type WsData = { id: string; authenticated: boolean; consumerKey: string | null };

// Track ACK commands received by the server
type AckRecord = { itemId: Buffer; timestamp: number };

// Minimal WebSocket server that speaks the contfu protocol
// This allows us to test the client without depending on @contfu/svc-app
function createTestWebSocketServer(port: number) {
  const connectedSockets = new Map<
    string,
    { ws: { send: (data: Buffer) => void }; data: WsData }
  >();
  const receivedAcks: AckRecord[] = [];

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
              // Track ACK for testing
              if (arr.length >= 2 && arr[1] instanceof Uint8Array) {
                receivedAcks.push({
                  itemId: Buffer.from(arr[1]),
                  timestamp: Date.now(),
                });
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
    // Get all received ACK commands (for testing)
    getReceivedAcks(): AckRecord[] {
      return [...receivedAcks];
    },
    // Clear received ACKs (for test isolation)
    clearReceivedAcks() {
      receivedAcks.length = 0;
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
    expect((receivedEvent as any).item.content).toEqual([
      { type: "paragraph", text: "Hello world" },
    ]);
  });

  describe("callback (handle) interface", () => {
    it("callback interface receives CHANGED events and sends ACK commands", async () => {
      // Clear any previous ACKs
      testServer.clearReceivedAcks();

      // Create test item data
      const testItemId = Buffer.alloc(16);
      testItemId.write("cb-test-item-001", 0, 16);
      const testRef = Buffer.alloc(16);
      testRef.write("cb-test-ref-0001", 0, 16);

      const testItem = {
        collection: 1,
        id: testItemId,
        ref: testRef,
        props: { title: "Callback Test Item", status: "active" },
        content: [{ type: "heading", text: "Hello callback" }],
        createdAt: Date.now(),
        changedAt: Date.now(),
      };

      // Track received events in callback
      const receivedEvents: unknown[] = [];

      // Use a flag to control when to stop (since handle doesn't return)
      let connectionPromiseResolve: () => void;
      const connectionCompleted = new Promise<void>((res) => {
        connectionPromiseResolve = res;
      });

      // Connect with callback handler (returns a Promise<void> that runs indefinitely)
      connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
        handle: async (event) => {
          receivedEvents.push(event);
          // Simulate async processing
          await new Promise((res) => setTimeout(res, 10));
          // After receiving the event, signal completion
          connectionPromiseResolve();
        },
      });

      // Broadcast event after connection is established
      setTimeout(() => {
        testServer.broadcast(testItem);
      }, 50);

      // Wait for callback to be invoked and complete
      await connectionCompleted;

      // Give time for ACK to be sent and processed
      await new Promise((res) => setTimeout(res, 50));

      // Verify callback received the CHANGED event
      expect(receivedEvents.length).toBeGreaterThanOrEqual(1);
      const receivedEvent = receivedEvents[0] as any;
      expect(receivedEvent.type).toBe(EventType.CHANGED);
      expect(receivedEvent.item).toBeDefined();
      expect(receivedEvent.item.props.title).toBe("Callback Test Item");
      expect(receivedEvent.item.content).toEqual([{ type: "heading", text: "Hello callback" }]);

      // Verify ACK was sent
      const acks = testServer.getReceivedAcks();
      expect(acks.length).toBeGreaterThanOrEqual(1);
      // Verify the ACK contains the correct item ID
      const ackItemId = acks[0].itemId;
      expect(ackItemId.toString("hex")).toBe(testItemId.toString("hex"));
    });

    it("callback interface receives DELETED events and sends ACK commands", async () => {
      // Clear any previous ACKs
      testServer.clearReceivedAcks();

      // Create test item ID for deletion
      const deletedItemId = Buffer.alloc(16);
      deletedItemId.write("del-test-item01", 0, 16);

      // Track received events in callback
      const receivedEvents: unknown[] = [];

      let connectionPromiseResolve: () => void;
      const connectionCompleted = new Promise<void>((res) => {
        connectionPromiseResolve = res;
      });

      // Connect with callback handler
      connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
        handle: async (event) => {
          receivedEvents.push(event);
          await new Promise((res) => setTimeout(res, 10));
          connectionPromiseResolve();
        },
      });

      // Send DELETED event after connection is established
      setTimeout(() => {
        testServer.sendDeleted(deletedItemId);
      }, 50);

      // Wait for callback to be invoked and complete
      await connectionCompleted;

      // Give time for ACK to be sent and processed
      await new Promise((res) => setTimeout(res, 50));

      // Verify callback received the DELETED event
      expect(receivedEvents.length).toBeGreaterThanOrEqual(1);
      const receivedEvent = receivedEvents[0] as any;
      expect(receivedEvent.type).toBe(EventType.DELETED);
      expect(receivedEvent.item).toBeDefined();
      // For DELETED events, item is the Buffer ID
      expect(receivedEvent.item.toString("hex")).toBe(deletedItemId.toString("hex"));

      // Verify ACK was sent with the deleted item ID
      const acks = testServer.getReceivedAcks();
      expect(acks.length).toBeGreaterThanOrEqual(1);
      const ackItemId = acks[0].itemId;
      expect(ackItemId.toString("hex")).toBe(deletedItemId.toString("hex"));
    });

    it("callback interface processes multiple events sequentially with ACKs", async () => {
      // Record starting ACK count (previous tests may have left connections open)
      const startingAckCount = testServer.getReceivedAcks().length;

      // Create multiple test items with unique IDs for this test
      const testItem1Id = Buffer.alloc(16);
      testItem1Id.write("multi-item-0001", 0, 16);
      const testItem2Id = Buffer.alloc(16);
      testItem2Id.write("multi-item-0002", 0, 16);

      const testRef = Buffer.alloc(16);
      testRef.write("multi-ref-00001", 0, 16);

      const testItem1 = {
        collection: 1,
        id: testItem1Id,
        ref: testRef,
        props: { title: "Item 1" },
        createdAt: Date.now(),
        changedAt: Date.now(),
      };

      const testItem2 = {
        collection: 1,
        id: testItem2Id,
        ref: testRef,
        props: { title: "Item 2" },
        createdAt: Date.now(),
        changedAt: Date.now(),
      };

      // Track received events for THIS connection only
      const receivedEvents: unknown[] = [];
      let eventCount = 0;

      let connectionPromiseResolve: () => void;
      const connectionCompleted = new Promise<void>((res) => {
        connectionPromiseResolve = res;
      });

      // Connect with callback handler
      connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
        handle: async (event) => {
          receivedEvents.push(event);
          eventCount++;
          // Simulate processing time
          await new Promise((res) => setTimeout(res, 20));
          // Complete after receiving both events
          if (eventCount >= 2) {
            connectionPromiseResolve();
          }
        },
      });

      // Broadcast events sequentially with delays
      setTimeout(() => {
        testServer.broadcast(testItem1);
      }, 50);

      setTimeout(() => {
        testServer.broadcast(testItem2);
      }, 150);

      // Wait for both callbacks to complete
      await connectionCompleted;

      // Give time for all ACKs to be sent and processed
      await new Promise((res) => setTimeout(res, 100));

      // Verify both events were received by this callback
      expect(receivedEvents.length).toBe(2);
      expect((receivedEvents[0] as any).item.props.title).toBe("Item 1");
      expect((receivedEvents[1] as any).item.props.title).toBe("Item 2");

      // Verify ACKs were sent - check for our specific item IDs
      const allAcks = testServer.getReceivedAcks();
      const newAcks = allAcks.slice(startingAckCount);

      // Find ACKs for our specific items
      const item1Ack = newAcks.find(
        (ack) => ack.itemId.toString("hex") === testItem1Id.toString("hex"),
      );
      const item2Ack = newAcks.find(
        (ack) => ack.itemId.toString("hex") === testItem2Id.toString("hex"),
      );

      expect(item1Ack).toBeDefined();
      expect(item2Ack).toBeDefined();
    });
  });

  describe("Event deserialization", () => {
    it("should deserialize CHANGED event with content correctly", async () => {
      const events = await connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
      });

      // Create test item data
      const testItemId = Buffer.alloc(16);
      testItemId.write("deser-chg-w-cnt", 0, 16);
      const testRef = Buffer.alloc(16);
      testRef.write("deser-ref-00001", 0, 16);

      const testItem = {
        collection: 42,
        id: testItemId,
        ref: testRef,
        props: { title: "Deserialization Test", count: 123, nested: { foo: "bar" } },
        content: [
          { type: "paragraph", text: "Content block" },
          { type: "heading", level: 1 },
        ],
        createdAt: 1700000000000,
        changedAt: 1700000001000,
      };

      // Broadcast event after a short delay
      setTimeout(() => {
        testServer.broadcast(testItem);
      }, 50);

      // Receive the event
      let receivedEvent: ChangedEvent | null = null;
      for await (const event of events) {
        if (event.type === EventType.CHANGED) {
          receivedEvent = event as ChangedEvent;
          break;
        }
      }

      // Verify deserialization
      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.type).toBe(EventType.CHANGED);
      expect(receivedEvent!.item.collection).toBe(42);
      expect(receivedEvent!.item.id).toBeInstanceOf(Buffer);
      expect(receivedEvent!.item.id.toString("hex")).toBe(testItemId.toString("hex"));
      expect(receivedEvent!.item.ref).toBeInstanceOf(Buffer);
      expect(receivedEvent!.item.ref.toString("hex")).toBe(testRef.toString("hex"));
      expect(receivedEvent!.item.createdAt).toBe(1700000000000);
      expect(receivedEvent!.item.changedAt).toBe(1700000001000);
      expect(receivedEvent!.item.props).toEqual({
        title: "Deserialization Test",
        count: 123,
        nested: { foo: "bar" },
      });
      expect(receivedEvent!.item.content).toEqual([
        { type: "paragraph", text: "Content block" },
        { type: "heading", level: 1 },
      ]);
    });

    it("should deserialize CHANGED event without content correctly", async () => {
      const events = await connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
      });

      // Create test item without content
      const testItemId = Buffer.alloc(16);
      testItemId.write("deser-chg-no-ct", 0, 16);
      const testRef = Buffer.alloc(16);
      testRef.write("deser-ref-00002", 0, 16);

      const testItem = {
        collection: 7,
        id: testItemId,
        ref: testRef,
        props: { title: "No Content Item" },
        // No content array
        createdAt: 1600000000000,
        changedAt: 1600000002000,
      };

      // Broadcast event after a short delay
      setTimeout(() => {
        testServer.broadcast(testItem);
      }, 50);

      // Receive the event
      let receivedEvent: ChangedEvent | null = null;
      for await (const event of events) {
        if (event.type === EventType.CHANGED) {
          receivedEvent = event as ChangedEvent;
          break;
        }
      }

      // Verify deserialization
      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.type).toBe(EventType.CHANGED);
      expect(receivedEvent!.item.collection).toBe(7);
      expect(receivedEvent!.item.id.toString("hex")).toBe(testItemId.toString("hex"));
      expect(receivedEvent!.item.props).toEqual({ title: "No Content Item" });
      expect(receivedEvent!.item.content).toBeUndefined();
    });

    it("should deserialize DELETED event correctly", async () => {
      const events = await connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
      });

      // Create test item ID for deletion
      const deletedItemId = Buffer.alloc(16);
      deletedItemId.write("deser-del-item1", 0, 16);

      // Send DELETED event after a short delay
      setTimeout(() => {
        testServer.sendDeleted(deletedItemId);
      }, 50);

      // Receive the event
      let receivedEvent: DeletedEvent | null = null;
      for await (const event of events) {
        if (event.type === EventType.DELETED) {
          receivedEvent = event as DeletedEvent;
          break;
        }
      }

      // Verify deserialization
      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.type).toBe(EventType.DELETED);
      expect(receivedEvent!.item).toBeInstanceOf(Buffer);
      expect(receivedEvent!.item.toString("hex")).toBe(deletedItemId.toString("hex"));
    });

    it("should deserialize LIST_IDS event correctly", async () => {
      const events = await connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
      });

      // Create test IDs
      const id1 = Buffer.alloc(16);
      id1.write("list-id-0000001", 0, 16);
      const id2 = Buffer.alloc(16);
      id2.write("list-id-0000002", 0, 16);
      const id3 = Buffer.alloc(16);
      id3.write("list-id-0000003", 0, 16);

      const testCollection = 99;

      // Send LIST_IDS event after a short delay
      setTimeout(() => {
        testServer.sendListIds(testCollection, [id1, id2, id3]);
      }, 50);

      // Receive the event
      let receivedEvent: ListIdsEvent | null = null;
      for await (const event of events) {
        if (event.type === EventType.LIST_IDS) {
          receivedEvent = event as ListIdsEvent;
          break;
        }
      }

      // Verify deserialization
      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.type).toBe(EventType.LIST_IDS);
      expect(receivedEvent!.collection).toBe(99);
      expect(receivedEvent!.ids).toBeInstanceOf(Array);
      expect(receivedEvent!.ids.length).toBe(3);
      expect(receivedEvent!.ids[0]).toBeInstanceOf(Buffer);
      expect(receivedEvent!.ids[0].toString("hex")).toBe(id1.toString("hex"));
      expect(receivedEvent!.ids[1].toString("hex")).toBe(id2.toString("hex"));
      expect(receivedEvent!.ids[2].toString("hex")).toBe(id3.toString("hex"));
    });

    it("should deserialize LIST_IDS event with empty ids array correctly", async () => {
      const events = await connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
      });

      const testCollection = 55;

      // Send LIST_IDS event with empty ids
      setTimeout(() => {
        testServer.sendListIds(testCollection, []);
      }, 50);

      // Receive the event
      let receivedEvent: ListIdsEvent | null = null;
      for await (const event of events) {
        if (event.type === EventType.LIST_IDS) {
          receivedEvent = event as ListIdsEvent;
          break;
        }
      }

      // Verify deserialization
      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.type).toBe(EventType.LIST_IDS);
      expect(receivedEvent!.collection).toBe(55);
      expect(receivedEvent!.ids).toBeInstanceOf(Array);
      expect(receivedEvent!.ids.length).toBe(0);
    });

    it("should deserialize CHECKSUM event correctly", async () => {
      const events = await connectTo(TEST_CONSUMER_KEY, {
        url: `ws://localhost:${PORT}/ws`,
      });

      // Create test checksum
      const testChecksum = Buffer.alloc(32);
      testChecksum.write("checksum-data-1234567890abcdef", 0, 32);

      const testCollection = 33;

      // Send CHECKSUM event after a short delay
      setTimeout(() => {
        testServer.sendChecksum(testCollection, testChecksum);
      }, 50);

      // Receive the event
      let receivedEvent: ChecksumEvent | null = null;
      for await (const event of events) {
        if (event.type === EventType.CHECKSUM) {
          receivedEvent = event as ChecksumEvent;
          break;
        }
      }

      // Verify deserialization
      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.type).toBe(EventType.CHECKSUM);
      expect(receivedEvent!.collection).toBe(33);
      expect(receivedEvent!.checksum).toBeInstanceOf(Buffer);
      expect(receivedEvent!.checksum.toString("hex")).toBe(testChecksum.toString("hex"));
    });
  });
});
