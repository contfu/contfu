import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { SyncMessageType, type UserSyncItem } from "@contfu/core";

// Create a more complete mock for db chainable methods
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
  // Handle the final async call
  chain.then = (resolve: any) => Promise.resolve(finalResult).then(resolve);
  return () => chain;
}

// Mock the database module before importing anything else
mock.module("../db/db", () => ({
  db: {
    $count: mock(() => Promise.resolve(3)),
    select: createChainableMock([{ itemIds: Buffer.alloc(0) }]),
    update: createChainableMock(undefined),
    query: {
      connection: {
        findMany: mock(() => Promise.resolve([])),
      },
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
  sourceTable: { userId: "userId", id: "id", type: "type", url: "url", credentials: "credentials" },
}));

// Dynamic import after mock
const { SyncWorkerManager } = await import("./worker-manager");

// Create a mock worker class
class MockWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private messages: unknown[] = [];
  private terminated = false;

  postMessage(msg: unknown) {
    if (this.terminated) return;
    this.messages.push(msg);
  }

  terminate() {
    this.terminated = true;
  }

  getMessages() {
    return this.messages;
  }

  isTerminated() {
    return this.terminated;
  }

  // Simulate sending message from worker to manager
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  simulateError(error: ErrorEvent) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

describe("SyncWorkerManager", () => {
  let mockWorker: MockWorker;
  let originalWorker: typeof globalThis.Worker;

  beforeEach(() => {
    mockWorker = new MockWorker();
    originalWorker = globalThis.Worker;
    // @ts-expect-error Mock Worker constructor
    globalThis.Worker = class {
      constructor() {
        return mockWorker;
      }
    };
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  describe("start", () => {
    it("should create a worker and wait for ready", async () => {
      const manager = new SyncWorkerManager();

      // Start in background, then simulate ready
      const startPromise = manager.start();

      // Wait a tick for the worker to be created
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Simulate worker ready message
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });

      await startPromise;
      // Should complete without error
    });

    it("should ignore multiple WORKER_READY messages", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Send ready twice
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });

      await startPromise;
      // Should complete without error (no double resolution)
    });
  });

  describe("stop", () => {
    it("should send shutdown message and terminate worker", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      await manager.stop();

      const messages = mockWorker.getMessages();
      expect(messages).toContainEqual({ type: SyncMessageType.SHUTDOWN });

      // Wait for terminate timeout
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(mockWorker.isTerminated()).toBe(true);
    });

    it("should handle stop when worker is not started", async () => {
      const manager = new SyncWorkerManager();
      await manager.stop(); // Should not throw
    });
  });

  describe("activateConsumer", () => {
    it("should send ACTIVATE_CONSUMER message", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      const count = await manager.activateConsumer(1, 2);

      expect(count).toBe(3); // From mocked db.$count
      const messages = mockWorker.getMessages();
      expect(messages).toContainEqual({
        type: SyncMessageType.ACTIVATE_CONSUMER,
        userId: 1,
        consumerId: 2,
        collectionCount: 3,
      });
    });
  });

  describe("deactivateConsumer", () => {
    it("should send DEACTIVATE_CONSUMER message", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      manager.deactivateConsumer(1, 2);

      const messages = mockWorker.getMessages();
      expect(messages).toContainEqual({
        type: SyncMessageType.DEACTIVATE_CONSUMER,
        userId: 1,
        consumerId: 2,
      });
    });
  });

  describe("onItems callback", () => {
    it("should invoke callback when items are fetched", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      const receivedItems: UserSyncItem[] = [];
      manager.onItems((items) => {
        receivedItems.push(...items);
      });

      const testItem: UserSyncItem = {
        user: 1,
        collection: 1,
        id: Buffer.alloc(16),
        ref: "test-ref",
        props: {},
        content: [],
        createdAt: 1000,
        changedAt: 2000,
      };

      mockWorker.simulateMessage({
        type: SyncMessageType.ITEMS_FETCHED,
        items: [testItem],
      });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedItems.length).toBe(1);
      expect(receivedItems[0].ref).toBe("test-ref");
    });

    it("should not invoke callback for empty items", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      let callbackInvoked = false;
      manager.onItems(() => {
        callbackInvoked = true;
      });

      mockWorker.simulateMessage({
        type: SyncMessageType.ITEMS_FETCHED,
        items: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callbackInvoked).toBe(false);
    });
  });

  describe("REQUEST_SYNC_INFO handling", () => {
    it("should respond to sync info requests", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      mockWorker.simulateMessage({
        type: SyncMessageType.REQUEST_SYNC_INFO,
        requestId: 42,
        pairs: [[1, 1]],
      });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      const messages = mockWorker.getMessages();
      const response = messages.find(
        (m: any) => m.type === SyncMessageType.SYNC_INFO_RESPONSE && m.requestId === 42,
      );
      expect(response).toBeDefined();
    });
  });

  describe("REQUEST_ADD_ITEM_IDS handling", () => {
    it("should respond to add item IDs requests", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      mockWorker.simulateMessage({
        type: SyncMessageType.REQUEST_ADD_ITEM_IDS,
        requestId: 99,
        userId: 1,
        collectionId: 1,
        itemIds: [Buffer.alloc(16)],
      });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      const messages = mockWorker.getMessages();
      const response = messages.find(
        (m: any) => m.type === SyncMessageType.ADD_ITEM_IDS_RESPONSE && m.requestId === 99,
      );
      expect(response).toBeDefined();
      expect((response as any).success).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle worker errors", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      // Simulate worker error
      const errorEvent = new ErrorEvent("error", { message: "Worker crashed" });
      mockWorker.simulateError(errorEvent);

      // Should not throw, error should be logged
    });

    it("should warn on unknown message type", async () => {
      const manager = new SyncWorkerManager();
      const startPromise = manager.start();

      await new Promise((resolve) => setTimeout(resolve, 0));
      mockWorker.simulateMessage({ type: SyncMessageType.WORKER_READY });
      await startPromise;

      // Send unknown message type
      mockWorker.simulateMessage({ type: 999 });

      // Should not throw
    });
  });
});
