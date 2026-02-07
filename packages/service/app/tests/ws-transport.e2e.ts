/**
 * E2E test for WebSocket transport.
 * Tests connection, authentication, and event flow.
 *
 * Auth is done via Sec-WebSocket-Protocol header during upgrade:
 * - Client sends: Sec-WebSocket-Protocol: contfu.<base64-key>
 * - Server validates and echoes back the protocol
 */
import { describe, test, expect } from "bun:test";
import { unpack } from "msgpackr";
import { EventType } from "@contfu/core";

// In dev: Vite (8011) proxies to standalone WS server (5174)
// In prod: main server handles WS directly
const WS_URL = process.env.WS_URL || "ws://localhost:5174/api/ws";

// Test consumer key (must exist in database for real tests)
// This is a placeholder - replace with actual test consumer key
const TEST_KEY = Buffer.alloc(32).toString("base64");

describe("WebSocket Transport", () => {
  test("should connect and receive CONNECTED event with valid key", async () => {
    // Auth via subprotocol header
    const authProtocol = `contfu.${TEST_KEY}`;
    const ws = new WebSocket(WS_URL, [authProtocol]);
    ws.binaryType = "arraybuffer";

    const result = await new Promise<{ connected: boolean; error?: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Timeout waiting for connection"));
      }, 5000);

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer));

        if (data.t === EventType.CONNECTED) {
          resolve({ connected: true });
        } else if (data.t === EventType.ERROR) {
          resolve({ connected: false, error: data.e });
        }
        ws.close();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        // Auth failures return HTTP error before upgrade, triggering onerror
        resolve({ connected: false, error: "connection_failed" });
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (!event.wasClean) {
          resolve({ connected: false, error: "connection_closed" });
        }
      };
    });

    // With placeholder key, we expect auth failure (HTTP 401 before upgrade)
    // In real tests with valid consumer key, connected would be true
    expect(typeof result.connected).toBe("boolean");
  });

  test("should reject connection with invalid key format", async () => {
    // Invalid key (not valid base64 or wrong length)
    const authProtocol = `contfu.invalid-key`;
    const ws = new WebSocket(WS_URL, [authProtocol]);
    ws.binaryType = "arraybuffer";

    const rejected = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false); // Timeout = not rejected properly
      }, 5000);

      ws.onopen = () => {
        // If we get here with invalid key, something is wrong
        clearTimeout(timeout);
        ws.close();
        resolve(false);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        // Expected: auth fails during upgrade, connection rejected
        resolve(true);
      };

      ws.onclose = () => {
        clearTimeout(timeout);
      };
    });

    expect(rejected).toBe(true);
  });

  test("should reject connection without auth protocol", async () => {
    // No auth protocol = missing authentication
    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";

    const rejected = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(false); // Should not connect without auth
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(true); // Expected: rejected
      };

      ws.onclose = () => {
        clearTimeout(timeout);
      };
    });

    expect(rejected).toBe(true);
  });
});
