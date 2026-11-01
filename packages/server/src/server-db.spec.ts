import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { collectionsTable, createDatabaseClient, itemTable as itemsTable } from "@contfu/contfu";
import { createServeOptions } from "./server";

type RouteRequest = Request & { params: Record<string, string> };
type ServeRoutes = NonNullable<ReturnType<typeof createServeOptions>["routes"]>;

function route(routes: ServeRoutes, path: string) {
  return routes[path] as (request: RouteRequest) => Response | Promise<Response>;
}

// Sync consumers are hot and process-scoped; keep their globals and workers out
// of this runner and terminate the owning process before removing its databases.

describe("configured Server databases", () => {
  let syncChild: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined;
  let syncDirectory: string | undefined;

  afterEach(async () => {
    if (syncChild) {
      if (syncChild.exitCode === null) syncChild.kill();
      await syncChild.exited;
      syncChild = undefined;
    }
    if (syncDirectory) {
      await rm(syncDirectory, { recursive: true, force: true });
      syncDirectory = undefined;
    }
  });

  test("runs background sync writes in the configured database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contfu-server-sync-"));
    syncDirectory = directory;
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "server-db.fixture.ts"),
        join(directory, "configured.sqlite"),
      ],
      {
        env: {
          ...process.env,
          CONTFU_KEY: Buffer.alloc(32).toString("base64url"),
          CONTFU_DB: join(directory, "default.sqlite"),
          DATABASE_URL: join(directory, "default.sqlite"),
          INTERNAL_SYNC_TRANSPORT: "websocket",
        },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    syncChild = child;
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, stderr || stdout).toBe(0);
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
