import { describe, test, expect } from "bun:test";
import { storeCliToken, consumeCliToken } from "./cli-token-store";

describe("cli-token-store", () => {
  const code = "TESTCODE";
  const apiKey = "test-api-key-123";

  test("stores and consumes a token", () => {
    storeCliToken(code, apiKey);
    expect(consumeCliToken(code)).toBe(apiKey);
  });

  test("returns null for unknown code", () => {
    expect(consumeCliToken("UNKNOWN")).toBeNull();
  });

  test("double-consume returns null", () => {
    storeCliToken("ONCE", apiKey);
    expect(consumeCliToken("ONCE")).toBe(apiKey);
    expect(consumeCliToken("ONCE")).toBeNull();
  });

  test("returns null for expired token", () => {
    storeCliToken("EXPIRED", apiKey);
    // Monkey-patch Date.now to simulate expiry
    const realNow = Date.now;
    Date.now = () => realNow() + 11 * 60 * 1000; // 11 minutes later
    expect(consumeCliToken("EXPIRED")).toBeNull();
    Date.now = realNow;
  });
});
