import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

// Mock WebSocket connection type matching Elysia's ws interface
type MockWebSocket = {
  send: (data: string) => void;
  close: () => void;
  subscribe: (event: string, callback: (data: any) => void) => void;
  publish: (event: string, data: any) => void;
  onMessage?: (data: any) => void;
  onClose?: () => void;
};

// Create a mock WebSocket connection
const createMockWebSocket = (): MockWebSocket => {
  const subscribers: Record<string, ((data: any) => void)[]> = {};

  return {
    send: (data: string) => {
      if (subscribers["message"]) {
        subscribers["message"].forEach((callback) => callback(data));
      }
    },
    close: () => {
      if (subscribers["close"]) {
        subscribers["close"].forEach((callback) => callback(null));
      }
    },
    subscribe: (event: string, callback: (data: any) => void) => {
      if (!subscribers[event]) {
        subscribers[event] = [];
      }
      subscribers[event].push(callback);
    },
    publish: (event: string, data: any) => {
      if (subscribers[event]) {
        subscribers[event].forEach((callback) => callback(data));
      }
    },
  };
};

// Test utility function to simulate WebSocket handler behavior
const testWebSocketHandler = async (
  handler: any,
  actions: (ws: MockWebSocket) => Promise<void>
) => {
  const ws = createMockWebSocket();

  // Setup message and close handlers
  ws.subscribe("message", (data) => {
    if (handler.message && ws.onMessage) {
      ws.onMessage(data);
    }
  });

  ws.subscribe("close", () => {
    if (handler.close && ws.onClose) {
      ws.onClose();
    }
  });

  // Run the handler setup
  await handler.open?.(ws as any);

  // Execute test actions
  await actions(ws);

  // Clean up
  ws.close();
  await handler.close?.(ws as any);
};

// Example usage in tests
describe("WebSocket Handler Tests", () => {
  it("should handle echo messages", async () => {
    const messages: string[] = [];

    const app = new Elysia().ws("/ws", {
      open(ws) {
        console.log("Connected");
      },
      message(ws, message) {
        ws.send(`Echo: ${message}`);
      },
      close(ws) {
        console.log("Closed");
      },
    });

    await testWebSocketHandler(app.routes[0].handler, async (ws) => {
      // Setup message handler
      ws.onMessage = (data) => {
        messages.push(data);
      };

      // Send test messages
      ws.send("Hello");
      ws.send("World");

      // Wait for any async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assertions
      expect(messages).toEqual(["Echo: Hello", "Echo: World"]);
    });
  });
});
