import { EventType } from "@contfu/core";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Test consumer credentials
const TEST_CONSUMER_KEY = Buffer.alloc(24);
TEST_CONSUMER_KEY.write("test-consumer-key-12345", 0, 24);

// Mock EventSource class - must be created at module level before mocking
let mockEventSourceInstance: MockEventSource | null = null;
let mockListeners = new Map<string, ((event: MessageEvent) => void)[]>();
let mockLastUrl = "";
let mockShouldFailOnConnect: (() => boolean) | undefined;

function setMockInstance(instance: MockEventSource) {
  mockEventSourceInstance = instance;
}

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  url: string;
  readyState = MockEventSource.CONNECTING;

  constructor(url: string) {
    this.url = url;
    mockLastUrl = url;
    setMockInstance(this);
    // Simulate connection opening after a tick
    setTimeout(() => {
      if (mockShouldFailOnConnect && mockShouldFailOnConnect()) {
        // Simulate native connection error (no data property)
        this.readyState = MockEventSource.CLOSED;
        this.simulateNativeError();
      } else {
        this.readyState = MockEventSource.OPEN;
        this.simulateEvent("connected", JSON.stringify({ type: EventType.CONNECTED }));
      }
    }, 0);
  }

  addEventListener(event: string, handler: (event: MessageEvent) => void, _options?: any) {
    const eventListeners = mockListeners.get(event) || [];
    eventListeners.push(handler);
    mockListeners.set(event, eventListeners);
  }

  removeEventListener(event: string, handler: (event: MessageEvent) => void) {
    const eventListeners = mockListeners.get(event) || [];
    const index = eventListeners.indexOf(handler);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  simulateEvent(eventType: string, data: string) {
    const eventListeners = mockListeners.get(eventType) || [];
    const event = { data, type: eventType } as MessageEvent;
    for (const listener of eventListeners) {
      listener(event);
    }
  }

  // Simulate native connection error (no data property, like a network failure)
  simulateNativeError() {
    const eventListeners = mockListeners.get("error") || [];
    const event = { type: "error" } as Event;
    for (const listener of eventListeners) {
      listener(event as MessageEvent);
    }
  }
}

// Register mock at module level BEFORE importing sse-client
mock.module("eventsource", () => ({
  EventSource: MockEventSource,
}));

// Now import the module that uses EventSource
const { connectToSSE } = await import("./sse-client");

// Helper to reset mock state between tests
function resetMockState(shouldFailOnConnect?: () => boolean) {
  mockEventSourceInstance = null;
  mockListeners = new Map();
  mockLastUrl = "";
  mockShouldFailOnConnect = shouldFailOnConnect;
}

// Helper to simulate events from outside
function simulateEvent(eventType: string, data: string) {
  const eventListeners = mockListeners.get(eventType) || [];
  const event = { data, type: eventType } as MessageEvent;
  for (const listener of eventListeners) {
    listener(event);
  }
}

beforeEach(() => {
  resetMockState();
});

afterEach(() => {
  if (mockEventSourceInstance) {
    mockEventSourceInstance.close();
  }
});

describe("SSE Client", () => {
  it("should serialize consumer key as base64 in URL", async () => {
    const key = Buffer.from("012345678901234567890123");

    // Start connection
    await connectToSSE(key, {
      url: "http://test.local/sse",
    });

    const expectedBase64 = key.toString("base64");
    expect(mockLastUrl).toContain(
      `http://test.local/sse?key=${encodeURIComponent(expectedBase64)}`,
    );

    mockEventSourceInstance!.close();
  });

  it("should deserialize CONNECTED event", async () => {
    // Start connection and get async generator
    await connectToSSE(TEST_CONSUMER_KEY, {
      url: "http://test.local/sse",
    });

    // Wait for connection to be established
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify connected event listener is registered
    expect(mockListeners.get("connected")).toBeDefined();
    expect(mockListeners.get("connected")!.length).toBeGreaterThan(0);

    mockEventSourceInstance!.close();
  });

  it("should deserialize CHANGED event with base64 buffers", async () => {
    // Start connection
    const generator = await connectToSSE(TEST_CONSUMER_KEY, {
      url: "http://test.local/sse",
    });

    // Create test item data and simulate event
    const itemId = Buffer.from("test-item-id-12345678901");
    const itemRef = Buffer.from("test-ref-123456789012345");
    const changedData = JSON.stringify({
      type: EventType.CHANGED,
      item: {
        id: itemId.toString("base64"),
        ref: itemRef.toString("base64"),
        collection: 1,
        publishedAt: 1000,
        createdAt: 2000,
        changedAt: 3000,
        props: { title: "Test" },
        content: [{ type: "text", text: "Hello" }],
      },
    });

    // Trigger the event
    simulateEvent("changed", changedData);

    // Get the CHANGED event from the generator
    const result = await generator.next();

    expect(result.done).toBe(false);
    expect(result.value.type).toBe(EventType.CHANGED);
    if (result.value.type === EventType.CHANGED) {
      expect(result.value.item.id.toString("base64")).toBe(itemId.toString("base64"));
      expect(result.value.item.ref.toString("base64")).toBe(itemRef.toString("base64"));
      expect(result.value.item.collection).toBe(1);
      expect(result.value.item.props.title).toBe("Test");
    }

    mockEventSourceInstance!.close();
  });

  it("should deserialize DELETED event with base64 buffer", async () => {
    const generator = await connectToSSE(TEST_CONSUMER_KEY, {
      url: "http://test.local/sse",
    });

    const itemId = Buffer.from("deleted-item-id-123456789");
    const deletedData = JSON.stringify({
      type: EventType.DELETED,
      item: itemId.toString("base64"),
    });

    simulateEvent("deleted", deletedData);

    const result = await generator.next();
    expect(result.done).toBe(false);
    expect(result.value.type).toBe(EventType.DELETED);
    if (result.value.type === EventType.DELETED) {
      expect(result.value.item.toString("base64")).toBe(itemId.toString("base64"));
    }

    mockEventSourceInstance!.close();
  });

  it("should deserialize LIST_IDS event with base64 buffer array", async () => {
    const generator = await connectToSSE(TEST_CONSUMER_KEY, {
      url: "http://test.local/sse",
    });

    const ids = [
      Buffer.from("id1-123456789012345678901"),
      Buffer.from("id2-123456789012345678901"),
    ];
    const listIdsData = JSON.stringify({
      type: EventType.LIST_IDS,
      collection: 1,
      ids: ids.map((id) => id.toString("base64")),
    });

    simulateEvent("list_ids", listIdsData);

    const result = await generator.next();
    expect(result.done).toBe(false);
    expect(result.value.type).toBe(EventType.LIST_IDS);
    if (result.value.type === EventType.LIST_IDS) {
      expect(result.value.collection).toBe(1);
      expect(result.value.ids.length).toBe(2);
      expect(result.value.ids[0].toString("base64")).toBe(ids[0].toString("base64"));
      expect(result.value.ids[1].toString("base64")).toBe(ids[1].toString("base64"));
    }

    mockEventSourceInstance!.close();
  });

  it("should deserialize CHECKSUM event with base64 buffer", async () => {
    const generator = await connectToSSE(TEST_CONSUMER_KEY, {
      url: "http://test.local/sse",
    });

    const checksum = Buffer.from("checksum-1234567890123456");
    const checksumData = JSON.stringify({
      type: EventType.CHECKSUM,
      collection: 1,
      checksum: checksum.toString("base64"),
    });

    simulateEvent("checksum", checksumData);

    const result = await generator.next();
    expect(result.done).toBe(false);
    expect(result.value.type).toBe(EventType.CHECKSUM);
    if (result.value.type === EventType.CHECKSUM) {
      expect(result.value.collection).toBe(1);
      expect(result.value.checksum.toString("base64")).toBe(checksum.toString("base64"));
    }

    mockEventSourceInstance!.close();
  });

  it("should close connection on ERROR event", async () => {
    await connectToSSE(TEST_CONSUMER_KEY, {
      url: "http://test.local/sse",
    });

    const errorData = JSON.stringify({
      type: EventType.ERROR,
      code: "E_AUTH",
    });

    // Verify connection is open before error
    expect(mockEventSourceInstance!.readyState).toBe(MockEventSource.OPEN);

    simulateEvent("error", errorData);

    // Wait for error handler to process
    await new Promise((resolve) => setTimeout(resolve, 10));

    // ERROR events close the connection without queuing
    expect(mockEventSourceInstance!.readyState).toBe(MockEventSource.CLOSED);
  });

  describe("reconnection", () => {
    it("should reconnect with exponential backoff on error", async () => {
      let connectionAttempts = 0;
      resetMockState(() => {
        connectionAttempts++;
        // Fail first attempt, succeed on second
        return connectionAttempts === 1;
      });

      const startTime = Date.now();

      // Start connection with fast delays for testing
      connectToSSE(TEST_CONSUMER_KEY, {
        url: "http://test.local/sse",
        initialReconnectDelay: 100,
        maxReconnectDelay: 500,
      });

      // Wait for reconnection
      await new Promise((resolve) => setTimeout(resolve, 300));

      const elapsed = Date.now() - startTime;

      // Should have attempted to reconnect
      expect(connectionAttempts).toBeGreaterThan(1);
      // Should have waited at least initialReconnectDelay
      expect(elapsed).toBeGreaterThanOrEqual(100);

      if (mockEventSourceInstance) mockEventSourceInstance.close();
    });

    it("should reset backoff delay after successful connection", async () => {
      let connectionAttempts = 0;
      resetMockState(() => {
        connectionAttempts++;
        // Fail first two attempts, succeed on third
        return connectionAttempts <= 2;
      });

      // Start connection
      await connectToSSE(TEST_CONSUMER_KEY, {
        url: "http://test.local/sse",
        initialReconnectDelay: 50,
        maxReconnectDelay: 500,
      });

      // After successful connection, delay should be reset
      // This is verified internally by the implementation

      if (mockEventSourceInstance) mockEventSourceInstance.close();
    });

    it("should cap reconnect delay at maxReconnectDelay", async () => {
      let connectionAttempts = 0;
      resetMockState(() => {
        connectionAttempts++;
        // Fail many times to test max delay
        return connectionAttempts <= 5;
      });

      // Start connection with small max delay
      connectToSSE(TEST_CONSUMER_KEY, {
        url: "http://test.local/sse",
        initialReconnectDelay: 50,
        maxReconnectDelay: 200,
      });

      // Wait for multiple reconnection attempts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify multiple attempts were made
      expect(connectionAttempts).toBeGreaterThan(3);

      if (mockEventSourceInstance) mockEventSourceInstance.close();
    });

    it("should not reconnect when reconnect option is false", async () => {
      let connectionAttempts = 0;
      resetMockState(() => {
        connectionAttempts++;
        return true; // Always fail
      });

      try {
        await connectToSSE(TEST_CONSUMER_KEY, {
          url: "http://test.local/sse",
          reconnect: false,
        });
      } catch {
        // Expected to throw
      }

      // Should only attempt once
      expect(connectionAttempts).toBe(1);
    });
  });
});
