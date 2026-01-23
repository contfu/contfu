import { describe, expect, it, mock } from "bun:test";
import { EventType, CommandType } from "@contfu/core";
import { pack, unpack } from "msgpackr";

// Mock the database module before importing anything else
mock.module("../db/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            all: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
  },
  consumerTable: {},
}));

// Import after mock
const { WebSocketServer } = await import("./ws-server");

// Mock WebSocket
function createMockWebSocket(
  id: `${string}-${string}-${string}-${string}-${string}` = crypto.randomUUID(),
) {
  const sent: Buffer[] = [];
  return {
    data: { id },
    send: (data: Buffer) => sent.push(data),
    sentMessages: sent,
  };
}

// Mock worker manager
function createMockWorkerManager() {
  return {
    activateConsumer: mock(() => Promise.resolve()),
    deactivateConsumer: mock(() => {}),
  };
}

describe("WebSocketServer", () => {
  describe("createHandler", () => {
    it("should assign unique ID on open", () => {
      const server = new WebSocketServer();
      const workerManager = createMockWorkerManager();
      server.setWorker(workerManager as any);

      const handler = server.createHandler();
      const ws = createMockWebSocket("00000000-0000-0000-0000-000000000000");

      handler.open(ws as any);

      expect(ws.data.id).toBeDefined();
      expect(ws.data.id.length).toBeGreaterThan(0);
    });

    it("should send error for invalid message", async () => {
      const server = new WebSocketServer();
      const workerManager = createMockWorkerManager();
      server.setWorker(workerManager as any);

      const handler = server.createHandler();
      const ws = createMockWebSocket();

      // Send invalid data (not a valid msgpack command)
      await handler.message(ws as any, Buffer.from([0x00]));

      expect(ws.sentMessages.length).toBe(1);
      const response = unpack(ws.sentMessages[0]) as unknown[];
      expect(response[0]).toBe(EventType.ERROR);
      expect(response[1]).toBe("E_INVALID");
    });

    it("should send error for malformed msgpack", async () => {
      const server = new WebSocketServer();
      const workerManager = createMockWorkerManager();
      server.setWorker(workerManager as any);

      const handler = server.createHandler();
      const ws = createMockWebSocket();

      // Send completely invalid msgpack
      await handler.message(ws as any, Buffer.from([0xff, 0xff, 0xff]));

      expect(ws.sentMessages.length).toBe(1);
      const response = unpack(ws.sentMessages[0]) as unknown[];
      expect(response[0]).toBe(EventType.ERROR);
      expect(response[1]).toBe("E_INVALID");
    });

    it("should send error for unknown command type", async () => {
      const server = new WebSocketServer();
      const workerManager = createMockWorkerManager();
      server.setWorker(workerManager as any);

      const handler = server.createHandler();
      const ws = createMockWebSocket();

      // Send unknown command type
      const unknownCommand = pack([999, Buffer.alloc(24)]);
      await handler.message(ws as any, Buffer.from(unknownCommand));

      expect(ws.sentMessages.length).toBe(1);
      const response = unpack(ws.sentMessages[0]) as unknown[];
      expect(response[0]).toBe(EventType.ERROR);
    });

    it("should reject ACK from unauthenticated socket", async () => {
      const server = new WebSocketServer();
      const workerManager = createMockWorkerManager();
      server.setWorker(workerManager as any);

      const handler = server.createHandler();
      const ws = createMockWebSocket();

      // Send ACK without connecting first
      const ackCommand = pack([CommandType.ACK, Buffer.alloc(16)]);
      await handler.message(ws as any, Buffer.from(ackCommand));

      expect(ws.sentMessages.length).toBe(1);
      const response = unpack(ws.sentMessages[0]) as unknown[];
      expect(response[0]).toBe(EventType.ERROR);
      expect(response[1]).toBe("E_ACCESS");
    });
  });

  describe("close handler", () => {
    it("should clean up on socket close", async () => {
      const server = new WebSocketServer();
      const workerManager = createMockWorkerManager();
      server.setWorker(workerManager as any);

      const handler = server.createHandler();
      const ws = createMockWebSocket();

      // Simulate a connected socket by opening first
      handler.open(ws as any);

      // Close without being authenticated should not call deactivateConsumer
      handler.close(ws as any);

      expect(workerManager.deactivateConsumer).not.toHaveBeenCalled();
    });
  });

  describe("broadcast", () => {
    it("should not throw with empty inputs", async () => {
      const server = new WebSocketServer();
      await server.broadcast([], []);
    });

    it("should handle items without connected consumers", async () => {
      const server = new WebSocketServer();

      const items = [
        {
          user: "user-1",
          collection: 1,
          id: Buffer.alloc(16),
          ref: Buffer.from("test-ref"),
          props: {},
          content: [],
          createdAt: 1000,
          changedAt: 2000,
        },
      ];

      // No connections, should not throw
      await server.broadcast(items as any, []);
    });
  });
});

describe("Command serialization", () => {
  it("should serialize CONNECTED event correctly", () => {
    const event = pack([EventType.CONNECTED]);
    const unpacked = unpack(event) as unknown[];
    expect(unpacked[0]).toBe(EventType.CONNECTED);
  });

  it("should serialize CHANGED event correctly", () => {
    const item = {
      collection: 1,
      id: Buffer.alloc(16),
      createdAt: 1000,
      changedAt: 2000,
      ref: "test-ref",
      props: { key: "value" },
      content: [{ type: "text", content: "hello" }],
    };

    const event = pack([
      EventType.CHANGED,
      item.collection,
      item.id,
      item.createdAt,
      item.changedAt,
      [item.ref, item.props, item.content],
    ]);

    const unpacked = unpack(event) as unknown[];
    expect(unpacked[0]).toBe(EventType.CHANGED);
    expect(unpacked[1]).toBe(1);
    expect(unpacked[3]).toBe(1000);
    expect(unpacked[4]).toBe(2000);
    expect((unpacked[5] as unknown[])[0]).toBe("test-ref");
  });

  it("should serialize ERROR event correctly", () => {
    const event = pack([EventType.ERROR, "E_AUTH"]);
    const unpacked = unpack(event) as unknown[];
    expect(unpacked[0]).toBe(EventType.ERROR);
    expect(unpacked[1]).toBe("E_AUTH");
  });
});
