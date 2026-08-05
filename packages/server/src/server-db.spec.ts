import { rm } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { EventType } from "@contfu/core";
import {
  collectionsTable,
  createDatabaseClient,
  getSyncIndex,
  itemTable as itemsTable,
  withDatabase,
} from "@contfu/contfu";
import { pack } from "msgpackr";
import { createServeOptions } from "./server";

type RouteRequest = Request & { params: Record<string, string> };
type ServeRoutes = NonNullable<ReturnType<typeof createServeOptions>["routes"]>;

function route(routes: ServeRoutes, path: string) {
  return routes[path] as (request: RouteRequest) => Response | Promise<Response>;
}

async function waitFor(check: () => boolean, timeout = 1_000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for sync event");
    await Bun.sleep(5);
  }
}

describe("configured Server databases", () => {
  test("runs background sync writes in the configured database", async () => {
    const databasePath = `/tmp/contfu-server-sync-${crypto.randomUUID()}.sqlite`;
    const originalKey = process.env.CONTFU_KEY;
    const originalWebSocket = globalThis.WebSocket;
    class MockSyncWebSocket {
      static readonly OPEN = 1;
      static current: MockSyncWebSocket | undefined;
      readyState = MockSyncWebSocket.OPEN;
      binaryType = "arraybuffer";
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: ((event: { code: number; reason: string }) => void) | null = null;
      private messageHandler: ((event: { data: Uint8Array }) => void) | null = null;

      constructor() {
        MockSyncWebSocket.current = this;
        queueMicrotask(() => this.onopen?.());
      }

      set onmessage(handler: ((event: { data: Uint8Array }) => void) | null) {
        this.messageHandler = handler;
        if (handler)
          queueMicrotask(() => handler({ data: pack([EventType.ITEM_DELETED, 1, 987_654]) }));
      }

      get onmessage() {
        return this.messageHandler;
      }

      send() {}
      close(code = 1000, reason = "") {
        this.readyState = 3;
        this.onclose?.({ code, reason });
      }
    }

    try {
      process.env.CONTFU_KEY = Buffer.alloc(32).toString("base64url");
      globalThis.WebSocket = MockSyncWebSocket as unknown as typeof WebSocket;
      createServeOptions({ db: databasePath });

      await waitFor(() => MockSyncWebSocket.current?.onmessage !== null);
      const configured = await createDatabaseClient(databasePath);
      await waitFor(() => withDatabase(configured, () => getSyncIndex()) === 987_654);
      expect(getSyncIndex()).not.toBe(987_654);
    } finally {
      if (originalKey === undefined) delete process.env.CONTFU_KEY;
      else process.env.CONTFU_KEY = originalKey;
      globalThis.WebSocket = originalWebSocket;
      await Promise.all(
        ["", "-wal", "-shm"].map((suffix) => rm(`${databasePath}${suffix}`, { force: true })),
      );
    }
  });

  test("isolates two configured Contfu runtime databases", async () => {
    const prefix = `/tmp/contfu-server-${crypto.randomUUID()}`;
    const firstPath = `${prefix}-one.sqlite`;
    const secondPath = `${prefix}-two.sqlite`;

    try {
      const seed = await createDatabaseClient(firstPath);
      seed
        .insert(collectionsTable)
        .values({ name: "posts", displayName: "Posts", schema: {} })
        .run();
      seed.insert(itemsTable).values({ id: 1, collection: "posts", changedAt: 1 }).run();

      const first = createServeOptions({ db: firstPath });
      const second = createServeOptions({ db: secondPath });
      const request = Object.assign(new Request("http://localhost/api/status"), { params: {} });
      const firstStatus = await route(first.routes!, "/api/status")(request);
      const secondStatus = await route(second.routes!, "/api/status")(request);

      expect(((await firstStatus.json()) as { itemCount: number }).itemCount).toBe(1);
      expect(((await secondStatus.json()) as { itemCount: number }).itemCount).toBe(0);
    } finally {
      await Promise.all(
        ["", "-wal", "-shm"].map((suffix) => rm(`${firstPath}${suffix}`, { force: true })),
      );
      await Promise.all(
        ["", "-wal", "-shm"].map((suffix) => rm(`${secondPath}${suffix}`, { force: true })),
      );
    }
  });
});
