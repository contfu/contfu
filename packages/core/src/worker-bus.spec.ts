import { describe, expect, it } from "bun:test";
import { MessageBus } from "./worker-bus";

describe("MessageBus", () => {
  describe("generateId", () => {
    it("should generate sequential IDs", () => {
      const bus = new MessageBus<string>();
      expect(bus.generateId()).toBe(1);
      expect(bus.generateId()).toBe(2);
      expect(bus.generateId()).toBe(3);
    });

    it("should wrap around at MAX_REQUEST_ID", () => {
      const bus = new MessageBus<string>();
      // Access private field for testing
      (bus as any).nextId = 2147483647;
      expect(bus.generateId()).toBe(2147483647);
      expect(bus.generateId()).toBe(1); // Wrapped
    });
  });

  describe("request", () => {
    it("should create a pending request", async () => {
      const bus = new MessageBus<string>();
      const id = bus.generateId();
      const promise = bus.request(id);
      expect(bus.pendingCount).toBe(1);

      // Clean up
      bus.respond(id, "cleanup");
      await promise;
    });

    it("should reject on duplicate request ID", async () => {
      const bus = new MessageBus<string>();
      const id = bus.generateId();
      const firstRequest = bus.request(id);

      await expect(bus.request(id)).rejects.toThrow("Request ID 1 already in use");

      // Clean up the first request
      bus.respond(id, "cleanup");
      await firstRequest;
    });

    it("should timeout after specified duration", async () => {
      const bus = new MessageBus<string>(50); // Very short timeout
      const id = bus.generateId();
      const promise = bus.request(id);

      await expect(promise).rejects.toThrow("Request 1 timed out after 50ms");
      expect(bus.pendingCount).toBe(0);
    });
  });

  describe("respond", () => {
    it("should resolve pending request with response", async () => {
      const bus = new MessageBus<string>();
      const id = bus.generateId();
      const promise = bus.request<string>(id);

      const responded = bus.respond(id, "test-response");

      expect(responded).toBe(true);
      expect(await promise).toBe("test-response");
      expect(bus.pendingCount).toBe(0);
    });

    it("should return false for unknown request ID", () => {
      const bus = new MessageBus<string>();
      const responded = bus.respond(999, "response");
      expect(responded).toBe(false);
    });

    it("should clear timeout when responding", async () => {
      const bus = new MessageBus<string>(100);
      const id = bus.generateId();
      const promise = bus.request<string>(id);

      bus.respond(id, "response");
      const result = await promise;

      expect(result).toBe("response");
      expect(bus.pendingCount).toBe(0);

      // Wait longer than timeout to ensure no rejection occurs
      await new Promise((resolve) => setTimeout(resolve, 150));
      // Test passes if we get here without unhandled rejection
    });
  });

  describe("reject", () => {
    it("should reject pending request with error", async () => {
      const bus = new MessageBus<string>();
      const id = bus.generateId();
      const promise = bus.request(id);

      const rejected = bus.reject(id, new Error("Custom error"));

      expect(rejected).toBe(true);
      await expect(promise).rejects.toThrow("Custom error");
      expect(bus.pendingCount).toBe(0);
    });

    it("should return false for unknown request ID", () => {
      const bus = new MessageBus<string>();
      const rejected = bus.reject(999, new Error("error"));
      expect(rejected).toBe(false);
    });
  });

  describe("clear", () => {
    it("should reject all pending requests", async () => {
      const bus = new MessageBus<string>();
      const id1 = bus.generateId();
      const id2 = bus.generateId();
      const promise1 = bus.request(id1);
      const promise2 = bus.request(id2);

      bus.clear(new Error("Shutdown"));

      await expect(promise1).rejects.toThrow("Shutdown");
      await expect(promise2).rejects.toThrow("Shutdown");
      expect(bus.pendingCount).toBe(0);
    });

    it("should use default error message", async () => {
      const bus = new MessageBus<string>();
      const id = bus.generateId();
      const promise = bus.request(id);

      bus.clear();

      await expect(promise).rejects.toThrow("Message bus cleared");
    });
  });

  describe("pendingCount", () => {
    it("should track pending requests accurately", async () => {
      const bus = new MessageBus<string>();
      expect(bus.pendingCount).toBe(0);

      const id1 = bus.generateId();
      const id2 = bus.generateId();
      const p1 = bus.request(id1);
      expect(bus.pendingCount).toBe(1);

      const p2 = bus.request(id2);
      expect(bus.pendingCount).toBe(2);

      bus.respond(id1, "response");
      expect(bus.pendingCount).toBe(1);

      bus.clear();
      expect(bus.pendingCount).toBe(0);

      // Wait for promises to settle
      await expect(p1).resolves.toBe("response");
      await expect(p2).rejects.toThrow("Message bus cleared");
    });
  });
});
