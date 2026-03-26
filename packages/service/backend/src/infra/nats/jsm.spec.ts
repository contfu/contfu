import { beforeEach, describe, expect, it, mock } from "bun:test";

let reconnectCallback: (() => void) | null = null;
const mockJetstreamManager = mock<() => Promise<unknown>>();

void mock.module("./connection", () => ({
  getNatsConnection: () => Promise.resolve({}),
  onNatsReconnect: (cb: () => void) => {
    reconnectCallback = cb;
  },
}));

void mock.module("@nats-io/jetstream", () => ({
  jetstreamManager: (...args: unknown[]) => mockJetstreamManager(...args),
}));

void mock.module("../logger/index", () => ({
  createLogger: () => ({
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

const { getJetStreamManager } = await import("./jsm");

describe("getJetStreamManager", () => {
  beforeEach(() => {
    mockJetstreamManager.mockReset();
    reconnectCallback?.();
  });

  it("returns JetStream manager on first attempt", async () => {
    const fakeJsm = { streams: () => {} };
    mockJetstreamManager.mockResolvedValueOnce(fakeJsm);

    const result = await getJetStreamManager();

    expect(result).toBe(fakeJsm);
    expect(mockJetstreamManager).toHaveBeenCalledTimes(1);
  });

  it("retries on error and eventually succeeds", async () => {
    const fakeJsm = { streams: () => {} };
    mockJetstreamManager.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(fakeJsm);

    const result = await getJetStreamManager();

    expect(result).toBe(fakeJsm);
    expect(mockJetstreamManager).toHaveBeenCalledTimes(2);
  });

  it("throws after exceeding 30s total timeout", async () => {
    const realDateNow = Date.now;
    let calls = 0;
    const base = 1_000_000;
    Date.now = () => {
      calls++;
      // First call is startTime; second call is elapsed check
      return calls === 1 ? base : base + 31_000;
    };

    mockJetstreamManager.mockRejectedValue(new Error("still broken"));

    try {
      await getJetStreamManager();
      throw new Error("expected getJetStreamManager to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain(
        "JetStream initialization failed after 30000ms: still broken",
      );
    } finally {
      Date.now = realDateNow;
    }
  });

  it("retries non-timeout errors within the timeout window", async () => {
    const fakeJsm = { streams: () => {} };
    mockJetstreamManager
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce(fakeJsm);

    const result = await getJetStreamManager();

    expect(result).toBe(fakeJsm);
    expect(mockJetstreamManager).toHaveBeenCalledTimes(2);
  });
});
