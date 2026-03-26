import { describe, expect, it } from "bun:test";
import { getLogContext, withLogContext } from "./log-context";

describe("log-context", () => {
  it("returns empty object when no context is active", () => {
    expect(getLogContext()).toEqual({});
  });

  it("propagates context to synchronous code", () => {
    withLogContext({ requestId: "r1" }, () => {
      expect(getLogContext()).toEqual({ requestId: "r1" });
    });
  });

  it("propagates context to async code", async () => {
    await withLogContext({ requestId: "r2" }, async () => {
      await Promise.resolve();
      expect(getLogContext()).toEqual({ requestId: "r2" });
    });
  });

  it("merges nested contexts", () => {
    withLogContext({ requestId: "r3" }, () => {
      withLogContext({ jobId: "j1" }, () => {
        expect(getLogContext()).toEqual({ requestId: "r3", jobId: "j1" });
      });
      // outer context is restored
      expect(getLogContext()).toEqual({ requestId: "r3" });
    });
  });

  it("inner context overrides parent keys", () => {
    withLogContext({ requestId: "r4" }, () => {
      withLogContext({ requestId: "r5" }, () => {
        expect(getLogContext()).toEqual({ requestId: "r5" });
      });
      expect(getLogContext()).toEqual({ requestId: "r4" });
    });
  });

  it("isolates concurrent async contexts", async () => {
    const results: string[] = [];

    await Promise.all([
      withLogContext({ requestId: "a" }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(`a:${getLogContext().requestId}`);
      }),
      withLogContext({ requestId: "b" }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(`b:${getLogContext().requestId}`);
      }),
    ]);

    expect(results).toContain("a:a");
    expect(results).toContain("b:b");
  });

  it("context is cleaned up after callback completes", () => {
    withLogContext({ requestId: "r6" }, () => {
      // inside context
    });
    expect(getLogContext()).toEqual({});
  });
});
