import { beforeEach, describe, expect, it } from "bun:test";
import { SourceType } from "@contfu/svc-core";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { sourceCollectionTable, userTable } from "../../infra/db/schema";
import { createSource } from "./createSource";
import { deleteSource } from "./deleteSource";
import { getSource } from "./getSource";
import { getSourceWithCollectionCount } from "./getSourceWithCollectionCount";
import { getSourceWithCredentials } from "./getSourceWithCredentials";
import { listSources } from "./listSources";
import { updateSource } from "./updateSource";

const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Source Features Happy Path", () => {
  let userId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "sources-happy@test.com" })
      .returning();
    userId = user.id;
  });

  it("should create and read a source", async () => {
    const created = await createSource(userId, {
      name: "My Strapi Source",
      type: SourceType.STRAPI,
      url: "https://strapi.example.com",
    });

    const fetched = await getSource(userId, created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.name).toBe("My Strapi Source");
    expect(fetched!.hasCredentials).toBe(false);
  });

  it("should update and delete a source", async () => {
    const created = await createSource(userId, {
      name: "Old Name",
      type: SourceType.STRAPI,
      url: "https://old.example.com",
    });

    const updated = await updateSource(userId, created.id, {
      name: "New Name",
      url: "https://new.example.com",
    });

    expect(updated).toBeDefined();
    expect(updated!.name).toBe("New Name");
    expect(updated!.url).toBe("https://new.example.com");

    const deleted = await deleteSource(userId, created.id);
    expect(deleted).toBe(true);

    const afterDelete = await getSource(userId, created.id);
    expect(afterDelete).toBeUndefined();
  });

  it("should decrypt credentials via getSourceWithCredentials", async () => {
    const created = await createSource(userId, {
      name: "Secret Source",
      type: SourceType.STRAPI,
      url: "https://strapi.example.com",
      credentials: Buffer.from("token-123"),
      webhookSecret: Buffer.from("whsec-456"),
    });

    const internal = await getSourceWithCredentials(userId, created.id);
    expect(internal).toBeDefined();
    expect(internal!.credentials).toEqual(Buffer.from("token-123"));
    expect(internal!.webhookSecret).toEqual(Buffer.from("whsec-456"));
  });

  it("should list sources with collection counts", async () => {
    const source1 = await createSource(userId, {
      name: "Source 1",
      type: SourceType.STRAPI,
      url: "https://one.example.com",
    });
    const source2 = await createSource(userId, {
      name: "Source 2",
      type: SourceType.STRAPI,
      url: "https://two.example.com",
    });

    await db.insert(sourceCollectionTable).values([
      { userId, sourceId: source1.id, name: "Articles" },
      { userId, sourceId: source1.id, name: "Pages" },
      { userId, sourceId: source2.id, name: "Posts" },
    ]);

    const all = await listSources(userId);
    expect(all).toHaveLength(2);

    const byId = new Map(all.map((s) => [s.id, s.collectionCount]));
    expect(byId.get(source1.id)).toBe(2);
    expect(byId.get(source2.id)).toBe(1);

    const one = await getSourceWithCollectionCount(userId, source1.id);
    expect(one).toBeDefined();
    expect(one!.collectionCount).toBe(2);
  });
});
