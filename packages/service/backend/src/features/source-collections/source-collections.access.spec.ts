import { beforeEach, describe, expect, it } from "bun:test";
import { SourceType } from "@contfu/svc-core";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { userTable } from "../../infra/db/schema";
import { createSource } from "../sources/createSource";
import { createSourceCollection } from "./createSourceCollection";
import { deleteCollection } from "./deleteCollection";
import { getCollection } from "./getCollection";
import { listCollections } from "./listCollections";
import { updateCollection } from "./updateCollection";

const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("SourceCollection Features Access Control", () => {
  let user1Id: number;
  let user2Id: number;
  let user1SourceId: number;
  let user2SourceId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user1, user2] = await db
      .insert(userTable)
      .values([
        { name: "User 1", email: "source-collections-user1@test.com" },
        { name: "User 2", email: "source-collections-user2@test.com" },
      ])
      .returning();

    user1Id = user1.id;
    user2Id = user2.id;

    const source1 = await createSource(user1Id, {
      name: "User1 Source",
      type: SourceType.STRAPI,
      url: "https://strapi.example.com",
    });
    const source2 = await createSource(user2Id, {
      name: "User2 Source",
      type: SourceType.STRAPI,
      url: "https://strapi.example.com",
    });

    user1SourceId = source1.id;
    user2SourceId = source2.id;
  });

  it("should not allow reading another user's source collection", async () => {
    const collection = await createSourceCollection(user1Id, {
      sourceId: user1SourceId,
      name: "User1 Source Collection",
    });

    const result = await getCollection(user2Id, collection.id);
    expect(result).toBeUndefined();
  });

  it("should not allow updating another user's source collection", async () => {
    const collection = await createSourceCollection(user1Id, {
      sourceId: user1SourceId,
      name: "User1 Source Collection",
    });

    const updated = await updateCollection(user2Id, collection.id, {
      name: "Hacked",
    });
    expect(updated).toBeUndefined();
  });

  it("should not allow deleting another user's source collection", async () => {
    const collection = await createSourceCollection(user1Id, {
      sourceId: user1SourceId,
      name: "User1 Source Collection",
    });

    const deleted = await deleteCollection(user2Id, collection.id);
    expect(deleted).toBe(false);
  });

  it("should only list source collections owned by the current user", async () => {
    await createSourceCollection(user1Id, {
      sourceId: user1SourceId,
      name: "User1 Source Collection",
    });
    await createSourceCollection(user2Id, {
      sourceId: user2SourceId,
      name: "User2 Source Collection",
    });

    const collections = await listCollections(user1Id);
    expect(collections).toHaveLength(1);
    expect(collections[0].userId).toBe(user1Id);
    expect(collections[0].name).toBe("User1 Source Collection");
  });
});
