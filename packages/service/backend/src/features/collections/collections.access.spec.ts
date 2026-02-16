import { beforeEach, describe, expect, it } from "bun:test";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { userTable } from "../../infra/db/schema";
import { createCollection } from "./createCollection";
import { deleteCollection } from "./deleteCollection";
import { getCollection } from "./getCollection";
import { listCollections } from "./listCollections";
import { updateCollection } from "./updateCollection";

const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Collection Features Access Control", () => {
  let user1Id: number;
  let user2Id: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user1, user2] = await db
      .insert(userTable)
      .values([
        { name: "User 1", email: "collections-user1@test.com" },
        { name: "User 2", email: "collections-user2@test.com" },
      ])
      .returning();

    user1Id = user1.id;
    user2Id = user2.id;
  });

  it("should not allow reading another user's collection", async () => {
    const collection = await createCollection(user1Id, { name: "User1 Collection" });

    const result = await getCollection(user2Id, collection.id);
    expect(result).toBeNull();
  });

  it("should not allow updating another user's collection", async () => {
    const collection = await createCollection(user1Id, { name: "User1 Collection" });

    const updated = await updateCollection(user2Id, collection.id, { name: "Hacked" });
    expect(updated).toBe(false);
  });

  it("should not allow deleting another user's collection", async () => {
    const collection = await createCollection(user1Id, { name: "User1 Collection" });

    const deleted = await deleteCollection(user2Id, collection.id);
    expect(deleted).toBe(false);
  });

  it("should only list collections owned by the current user", async () => {
    await createCollection(user1Id, { name: "User1 Collection" });
    await createCollection(user2Id, { name: "User2 Collection" });

    const collections = await listCollections(user1Id);
    expect(collections).toHaveLength(1);
    expect(collections[0].userId).toBe(user1Id);
    expect(collections[0].name).toBe("User1 Collection");
  });
});
