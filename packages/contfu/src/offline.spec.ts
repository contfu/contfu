import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contfu } from "./contfu";
import { createDatabaseClient, withDatabase } from "./infra/db/db";
import { setCollection } from "./features/collections/setCollection";
import { createItem } from "./features/items/createItem";

afterEach(() => mock.restore());

test("offline runtime queries a read-only replica without connecting or migrating", async () => {
  const dir = await mkdtemp(join(tmpdir(), "contfu-offline-"));
  const path = join(dir, "replica.sqlite");
  const writer = await createDatabaseClient(path, { journalMode: "delete" });
  withDatabase(writer, () => {
    setCollection("articles", "Articles", {});
    createItem({ id: 1, collection: "articles", props: { title: "Replicated" }, changedAt: 1 });
  });
  const reader = await createDatabaseClient(path, { readonly: true });
  const fetch = spyOn(globalThis, "fetch");
  fetch.mockClear();
  const oldKey = process.env.CONTFU_KEY;
  process.env.CONTFU_KEY = Buffer.alloc(32).toString("base64url");
  try {
    const instance = contfu<{ articles: { title: string } }>({ offline: true, database: reader });
    const rows = await instance.query("articles");
    expect(rows[0].title).toBe("Replicated");
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/api/sync"))).toHaveLength(0);
    expect(() => withDatabase(reader, () => setCollection("forbidden", "Forbidden", {}))).toThrow();
  } finally {
    if (oldKey === undefined) delete process.env.CONTFU_KEY;
    else process.env.CONTFU_KEY = oldKey;
    await rm(dir, { recursive: true, force: true });
  }
});
