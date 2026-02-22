import { SourceType } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { userTable } from "../../infra/db/schema";
import { createSource } from "./createSource";
import { deleteSource } from "./deleteSource";
import { getSource } from "./getSource";
import { listSources } from "./listSources";
import { updateSource } from "./updateSource";

const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Source Features Access Control", () => {
  let user1Id: number;
  let user2Id: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user1, user2] = await db
      .insert(userTable)
      .values([
        { name: "User 1", email: "sources-user1@test.com" },
        { name: "User 2", email: "sources-user2@test.com" },
      ])
      .returning();

    user1Id = user1.id;
    user2Id = user2.id;
  });

  it("should not allow reading another user's source", async () => {
    const source = await runTest(
      createSource(user1Id, {
        name: "User1 Source",
        type: SourceType.STRAPI,
        url: "https://strapi.example.com",
      }),
    );

    const result = await runTest(getSource(user2Id, source.id));
    expect(result).toBeUndefined();
  });

  it("should not allow updating another user's source", async () => {
    const source = await runTest(
      createSource(user1Id, {
        name: "User1 Source",
        type: SourceType.STRAPI,
        url: "https://strapi.example.com",
      }),
    );

    const updated = await runTest(updateSource(user2Id, source.id, { name: "Hacked" }));
    expect(updated).toBeUndefined();
  });

  it("should not allow deleting another user's source", async () => {
    const source = await runTest(
      createSource(user1Id, {
        name: "User1 Source",
        type: SourceType.STRAPI,
        url: "https://strapi.example.com",
      }),
    );

    const deleted = await runTest(deleteSource(user2Id, source.id));
    expect(deleted).toBe(false);
  });

  it("should only list sources owned by the current user", async () => {
    await runTest(
      createSource(user1Id, {
        name: "User1 Source",
        type: SourceType.STRAPI,
        url: "https://strapi.example.com",
      }),
    );
    await runTest(
      createSource(user2Id, {
        name: "User2 Source",
        type: SourceType.STRAPI,
        url: "https://strapi.example.com",
      }),
    );

    const sources = await runTest(listSources(user1Id));
    expect(sources).toHaveLength(1);
    expect(sources[0].userId).toBe(user1Id);
    expect(sources[0].name).toBe("User1 Source");
  });
});
