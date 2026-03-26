import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockKvPut = mock<(subject: string, value: string) => Promise<number>>();
const mockKvCreate = mock<(subject: string, value: string) => Promise<number>>();

const mockKv = {
  put: mockKvPut,
  create: mockKvCreate,
};

const mockKvmCreate = mock(() => Promise.resolve(mockKv));

void mock.module("./kvm", () => ({
  getKvManager: () => Promise.resolve({ create: mockKvmCreate }),
}));

void mock.module("../logger/index", () => ({
  createLogger: () => ({
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

// Fresh import for each test file run
const { isLeader, raceForLeader } = await import("./leader-election");

describe("leader-election", () => {
  beforeEach(() => {
    mockKvPut.mockReset();
    mockKvCreate.mockReset();
    mockKvmCreate.mockReset();
    mockKvmCreate.mockImplementation(() => Promise.resolve(mockKv));
  });

  describe("isLeader", () => {
    it("returns false for unknown subjects", () => {
      expect(isLeader("unknown-subject")).toBe(false);
    });
  });

  describe("raceForLeader", () => {
    it("yields true when kv.create() succeeds", async () => {
      mockKvCreate.mockResolvedValueOnce(1);

      const gen = raceForLeader("test-subject", { interval: 0 });
      const result = await gen.next();

      expect(result.value).toBe(true);
      expect(mockKvCreate).toHaveBeenCalledTimes(1);
    });

    it("yields false when kv.create() throws", async () => {
      mockKvCreate.mockRejectedValueOnce(new Error("key exists"));

      const gen = raceForLeader("fail-subject", { interval: 0 });
      const result = await gen.next();

      expect(result.value).toBe(false);
    });

    it("refreshes leadership with kv.put() on subsequent iterations", async () => {
      // First iteration: acquire leadership
      mockKvCreate.mockResolvedValueOnce(1);
      mockKvPut.mockResolvedValue(2);

      const gen = raceForLeader("refresh-subject", { interval: 0 });

      // First yield: acquired leadership
      const first = await gen.next();
      expect(first.value).toBe(true);

      // Second iteration: already leader, refreshes via put, no yield (status unchanged)
      // Third iteration: same — still leader, refreshes via put
      // The generator won't yield again because status hasn't changed,
      // so we need to make create fail to force a status change to get the next yield
      mockKvCreate.mockRejectedValueOnce(new Error("key exists"));

      // Advance the generator — it will call put() (refresh), then loop again
      // We need to break out, so let's use Promise.race with a timeout
      const raceResult = await Promise.race([
        gen.next(),
        new Promise<{ value: undefined; done: false }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: false }), 100),
        ),
      ]);

      // The put should have been called (leadership refresh)
      expect(mockKvPut).toHaveBeenCalled();

      // If we got a yield, it means status changed (shouldn't happen while leader is refreshing)
      // The timeout means the generator is looping without yielding (correct behavior)
      if (raceResult.value === undefined) {
        // Timed out — generator is refreshing without yielding, which is correct
        expect(mockKvPut).toHaveBeenCalled();
      }
    });

    it("only yields on status change", async () => {
      // Both attempts fail — should only yield false once
      mockKvCreate
        .mockRejectedValueOnce(new Error("key exists"))
        .mockRejectedValueOnce(new Error("key exists"));

      const gen = raceForLeader("no-dup-subject", { interval: 0 });

      // First yield: false (failed to become leader)
      const first = await gen.next();
      expect(first.value).toBe(false);

      // Second iteration: still not leader, status unchanged — no yield
      // Make third attempt succeed to force a status change
      mockKvCreate.mockResolvedValueOnce(1);

      const second = await gen.next();
      // Should yield true (status changed from false to true)
      expect(second.value).toBe(true);
    });

    it("updates isLeader after acquiring leadership", async () => {
      mockKvCreate.mockResolvedValueOnce(1);

      const subject = "sync-subject";
      expect(isLeader(subject)).toBe(false);

      const gen = raceForLeader(subject, { interval: 0 });
      const result = await gen.next();

      expect(result.value).toBe(true);
      expect(isLeader(subject)).toBe(true);
    });
  });
});
