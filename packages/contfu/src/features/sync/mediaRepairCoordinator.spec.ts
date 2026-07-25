/* oxlint-disable typescript/unbound-method -- mock method references in expect() assertions are intentionally unbound */
import { describe, expect, mock, test } from "bun:test";
import { CommandResult, RefreshStatus } from "@contfu/core";
import type { CommandResultEvent, StreamCommandSender } from "@contfu/connect";
import { createMediaRepairCoordinator } from "./mediaRepairCoordinator";

function sender(): StreamCommandSender {
  return {
    refresh: mock(() =>
      Promise.resolve({
        type: CommandResult.REFRESH,
        commandId: 1,
        status: RefreshStatus.ACCEPTED,
      }),
    ),
    refreshAll: mock(() =>
      Promise.resolve({
        type: CommandResult.REFRESH_ALL,
        commandId: 1,
        status: RefreshStatus.ACCEPTED,
      }),
    ),
  };
}

describe("media repair coordinator", () => {
  test("coalesces offline repair requests and sends them after reconnect", () => {
    const coordinator = createMediaRepairCoordinator();
    const stream = sender();

    coordinator.repair("posts", [3], true);
    coordinator.repair("posts", [7, 3], true);
    expect(stream.refresh).not.toHaveBeenCalled();

    coordinator.connected(stream);

    expect(stream.refresh).toHaveBeenCalledWith("posts", [3, 7], true);
  });

  test("uses a collection refresh for broad or unscoped repair", () => {
    const coordinator = createMediaRepairCoordinator();
    const stream = sender();
    coordinator.connected(stream);

    coordinator.repair("posts", [], true);

    expect(stream.refreshAll).toHaveBeenCalledWith("posts", true);
  });

  test("requeues a command that disconnects before receiving its result", () => {
    let resolve!: (result: CommandResultEvent) => void;
    const stream = sender();
    stream.refresh = mock(
      () =>
        new Promise<CommandResultEvent>((done) => {
          resolve = done;
        }),
    );
    const coordinator = createMediaRepairCoordinator();
    coordinator.connected(stream);
    coordinator.repair("posts", [3], true);

    coordinator.disconnected();
    coordinator.connected(stream);

    expect(stream.refresh).toHaveBeenCalledTimes(2);
    resolve({ type: CommandResult.REFRESH, commandId: 1, status: RefreshStatus.ACCEPTED });
  });

  test("merges repairs queued while another repair awaits its command result", () => {
    const resolvers: ((result: CommandResultEvent) => void)[] = [];
    const stream = sender();
    stream.refresh = mock(
      () =>
        new Promise<CommandResultEvent>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const coordinator = createMediaRepairCoordinator();
    coordinator.connected(stream);
    coordinator.repair("posts", [3], true);
    coordinator.repair("posts", [7], true);

    expect(stream.refresh).toHaveBeenCalledTimes(1);
    coordinator.disconnected();
    coordinator.connected(stream);

    expect(stream.refresh).toHaveBeenLastCalledWith("posts", [3, 7], true);
    resolvers[0]({ type: CommandResult.REFRESH, commandId: 1, status: RefreshStatus.ACCEPTED });
  });

  test("does not let a stale command result untrack a reconnected repair", () => {
    const resolvers: ((result: CommandResultEvent) => void)[] = [];
    const stream = sender();
    stream.refresh = mock(
      () =>
        new Promise<CommandResultEvent>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const coordinator = createMediaRepairCoordinator();
    coordinator.connected(stream);
    coordinator.repair("posts", [3], true);
    coordinator.disconnected();
    coordinator.connected(stream);

    resolvers[0]({ type: CommandResult.REFRESH, commandId: 1, status: RefreshStatus.ACCEPTED });
    coordinator.disconnected();
    coordinator.connected(stream);

    expect(stream.refresh).toHaveBeenCalledTimes(3);
    expect(stream.refresh).toHaveBeenLastCalledWith("posts", [3], true);
  });
});
