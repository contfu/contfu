import { test, expect } from "@playwright/test";

/**
 * SSE Authentication Tests
 *
 * Tests for the /api/sse endpoint authentication behavior.
 * The SSE endpoint expects a ?key= parameter containing a base64-encoded 32-byte consumer key.
 *
 * KNOWN ISSUE: The eventsource package (and native EventSource API) don't pass through
 * the `data` field for `event: error` events. The server sends proper error data like:
 *   event: error
 *   data: {"type":"error","code":"consumer_not_found"}
 * But clients only see an error event fired with no data. These tests document this behavior.
 */

const BASE_URL = "http://localhost:4173";

// Helper to read SSE events from a response with timeout
async function readSSEEvents(
  response: Response,
  timeoutMs: number = 2000,
): Promise<{ events: Array<{ event?: string; data?: string }>; timedOut: boolean }> {
  const events: Array<{ event?: string; data?: string }> = [];
  const reader = response.body?.getReader();
  if (!reader) return { events, timedOut: false };

  const decoder = new TextDecoder();
  let buffer = "";
  let timedOut = false;

  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs),
  );

  try {
    while (true) {
      const result = await Promise.race([reader.read(), timeoutPromise]);

      if (result === "timeout") {
        timedOut = true;
        reader.cancel();
        break;
      }

      const { done, value } = result as ReadableStreamReadResult<Uint8Array>;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      let currentEvent: { event?: string; data?: string } = {};
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent.event = line.slice(7);
        } else if (line.startsWith("data: ")) {
          currentEvent.data = line.slice(6);
        } else if (line === "" && (currentEvent.event || currentEvent.data)) {
          events.push(currentEvent);
          currentEvent = {};
        }
      }
    }
  } catch {
    // Stream cancelled or errored
  }

  return { events, timedOut };
}

// Generate a valid-format but non-existent key (32 bytes -> base64)
function generateFakeKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

test.describe("SSE Authentication", () => {
  test("missing key returns 401", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/sse`);

    expect(response.status()).toBe(401);
    expect(await response.text()).toBe("Missing authentication key");
  });

  test("empty key parameter returns 401", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/sse?key=`);

    expect(response.status()).toBe(401);
    expect(await response.text()).toBe("Missing authentication key");
  });

  test("malformed key (not base64, not 32 bytes) returns 401", async ({ request }) => {
    // Too short, invalid base64
    const response = await request.get(`${BASE_URL}/api/sse?key=notavalidkey`);

    expect(response.status()).toBe(401);
    expect(await response.text()).toBe("Invalid key format");
  });

  test("malformed key (valid base64 but wrong length) returns 401", async ({ request }) => {
    // Valid base64 but only 16 bytes
    const shortKey = btoa(String.fromCharCode(...new Uint8Array(16)));
    const response = await request.get(`${BASE_URL}/api/sse?key=${encodeURIComponent(shortKey)}`);

    expect(response.status()).toBe(401);
    expect(await response.text()).toBe("Invalid key format");
  });

  test("valid format key but non-existent consumer returns 200 with error event", async () => {
    /**
     * KNOWN BUG DOCUMENTATION:
     * The server correctly returns 200 and sends an SSE error event with data.
     * However, the EventSource API doesn't pass the data field for error events.
     *
     * Server sends:
     *   event: error
     *   data: {"type":"error","code":"consumer_not_found"}
     *
     * But eventsource clients only see: new ErrorEvent('error', {})
     *
     * Using raw fetch to verify the actual server response is correct.
     */
    const fakeKey = generateFakeKey();
    const response = await fetch(`${BASE_URL}/api/sse?key=${encodeURIComponent(fakeKey)}`);

    // Server returns 200 with SSE stream (not a direct HTTP error)
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    // Read the actual SSE events
    const { events, timedOut } = await readSSEEvents(response, 2000);

    // Should NOT time out - server should send error and close
    expect(timedOut).toBe(false);

    // Should receive an error event with consumer_not_found code
    expect(events.length).toBeGreaterThanOrEqual(1);

    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.data).toBeDefined();

    const errorData = JSON.parse(errorEvent!.data!);
    expect(errorData.type).toBe("error");
    // Server returns E_AUTH for invalid/unknown consumer keys
    expect(errorData.code).toBe("E_AUTH");
  });

  test("Authorization header with Bearer token also works", async ({ request }) => {
    const fakeKey = generateFakeKey();
    const response = await request.get(`${BASE_URL}/api/sse`, {
      headers: {
        Authorization: `Bearer ${fakeKey}`,
      },
    });

    // Should process the key (even though it's invalid, it should get past key parsing)
    // We expect 200 with error event, not 401
    expect(response.status()).toBe(200);
  });

  test("query param key takes precedence over Authorization header", async () => {
    // Use raw fetch to get streaming response
    const fakeKey = generateFakeKey();
    const differentKey = generateFakeKey();

    const response = await fetch(`${BASE_URL}/api/sse?key=${encodeURIComponent(fakeKey)}`, {
      headers: {
        Authorization: `Bearer ${differentKey}`,
      },
    });

    // Should use query param key (returns 200 with error event)
    expect(response.status).toBe(200);

    const { events } = await readSSEEvents(response, 2000);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
  });

  test("hex-encoded key (64 chars = 32 bytes) is also accepted", async () => {
    // Generate 32 random bytes as hex (64 characters)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hexKey = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const response = await fetch(`${BASE_URL}/api/sse?key=${hexKey}`);

    // Should accept the format (even though consumer doesn't exist)
    expect(response.status).toBe(200);

    const { events, timedOut } = await readSSEEvents(response, 2000);
    expect(timedOut).toBe(false);

    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
  });

  // Note: Testing valid key with "connected" event requires a real registered consumer
  // which would need database setup. This test documents what SHOULD happen:
  test.skip("valid registered consumer key gets connected event", async () => {
    /**
     * With a valid consumer key, the server should:
     * 1. Return 200 with text/event-stream
     * 2. Send: event: connected\ndata: {"connectionId":"..."}\n\n
     * 3. Keep connection open with periodic ping events
     *
     * This test is skipped because it requires:
     * - Creating a user
     * - Creating a source
     * - Getting the consumer key from the database
     *
     * The sources.e2e.ts tests already cover consumer key generation.
     */
  });
});
