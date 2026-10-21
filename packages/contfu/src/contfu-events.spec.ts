/* oxlint-disable typescript/await-thenable -- AsyncIterator.next returns a promise in these tests. */
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { ConsumerAlreadyConnectedError } from "@contfu/connect";
import { EventType } from "@contfu/core";
import * as connection from "./connect";
import { contfu } from "./contfu";

const originalSetTimeout = globalThis.setTimeout;
const key = Buffer.alloc(32).toString("base64url");

afterEach(() => {
  // Each active test forces the runner to terminate before restoring its spies.
  connectionSpy?.mockRestore();
  timeoutSpy?.mockRestore();
});
let connectionSpy: ReturnType<typeof spyOn<typeof connection, "connect">> | undefined;
let timeoutSpy: ReturnType<typeof spyOn<typeof globalThis, "setTimeout">> | undefined;

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Contfu hot event lifecycle", () => {
  test("ownership conflicts keep restarting; terminal completion drains queues and settles all reads", async () => {
    let attempts = 0;
    connectionSpy = spyOn(connection, "connect").mockImplementation(async function* () {
      await Promise.resolve();
      attempts++;
      if (attempts === 1) throw new ConsumerAlreadyConnectedError();
      if (attempts === 2) yield { type: EventType.STREAM_CONNECTED };
    });
    const delays: number[] = [];
    const timers: (() => void)[] = [];
    const scheduled = [signal(), signal()];
    timeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((
      callback: () => void,
      delay: number,
    ) => {
      if (delay !== 1_000 && delay !== 2_000) return originalSetTimeout(callback, delay);
      if (attempts === 3) throw new Error("Runner terminated");
      delays.push(delay);
      timers.push(callback);
      scheduled[attempts - 1].resolve();
      return 1 as unknown as Timer;
    }) as typeof setTimeout);

    const { events } = contfu({ key });
    const queued = events[Symbol.asyncIterator]();
    const pending = events[Symbol.asyncIterator]();
    const firstRead = pending.next();
    expect((await firstRead).value).toEqual({
      type: EventType.STREAM_DISCONNECTED,
      reason: new ConsumerAlreadyConnectedError().message,
    });
    await scheduled[0].promise;
    expect(attempts).toBe(1);
    timers.shift()!();
    expect((await pending.next()).value?.type).toBe(EventType.STREAM_CONNECTED);
    expect((await pending.next()).value).toEqual({
      type: EventType.STREAM_DISCONNECTED,
      reason: "Sync stream ended unexpectedly",
    });
    await scheduled[1].promise;
    const reads = [pending.next(), pending.next(), pending.next(), pending.next()];
    timers.shift()!();
    expect((await reads[0]).value).toEqual({
      type: EventType.STREAM_DISCONNECTED,
      reason: "Sync stream ended unexpectedly",
    });
    expect((await reads[1]).value).toEqual({
      type: EventType.STREAM_DISCONNECTED,
      reason: "Runner terminated",
    });
    expect((await reads[2]).done).toBe(true);
    expect((await reads[3]).done).toBe(true);
    expect((await pending.next()).done).toBe(true);
    expect(attempts).toBe(3);
    expect(delays).toEqual([1_000, 1_000]);

    const drained = [];
    for (let result = await queued.next(); !result.done; result = await queued.next()) {
      drained.push(result.value);
    }
    expect(drained.map((event) => event.type)).toEqual([
      EventType.STREAM_DISCONNECTED,
      EventType.STREAM_CONNECTED,
      EventType.STREAM_DISCONNECTED,
      EventType.STREAM_DISCONNECTED,
      EventType.STREAM_DISCONNECTED,
    ]);
    expect(drained.at(-1)).toMatchObject({ reason: "Runner terminated" });
    expect((await events[Symbol.asyncIterator]().next()).done).toBe(true);
  });

  test("return settles concurrent pending reads, discards queued events and closes future reads", async () => {
    const terminated = signal();
    connectionSpy = spyOn(connection, "connect").mockImplementation(async function* () {});
    timeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((
      callback: () => void,
      delay: number,
    ) => {
      if (delay !== 1_000) return originalSetTimeout(callback, delay);
      terminated.resolve();
      throw new Error("Runner terminated");
    }) as unknown as typeof setTimeout);
    const { events } = contfu({ key });
    const pending = events[Symbol.asyncIterator]();
    const reads = [pending.next(), pending.next()];
    await pending.return!();
    expect((await reads[0]).done).toBe(true);
    expect((await reads[1]).done).toBe(true);
    expect((await pending.next()).done).toBe(true);
    const queued = events[Symbol.asyncIterator]();
    await terminated.promise;
    await queued.return!();
    expect((await queued.next()).done).toBe(true);
  });

  test("inactive and offline iterators complete immediately, including after return", async () => {
    for (const options of [
      { key: "", offline: false },
      { key, offline: true },
    ]) {
      const iterator = contfu(options).events[Symbol.asyncIterator]();
      expect((await iterator.next()).done).toBe(true);
      await iterator.return!();
      expect((await iterator.next()).done).toBe(true);
    }
  });
});
