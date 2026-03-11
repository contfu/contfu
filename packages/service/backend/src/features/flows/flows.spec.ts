import { beforeEach, describe, expect, it } from "bun:test";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { collectionTable, userTable } from "../../infra/db/schema";
import { createFlow } from "./createFlow";

describe("Flow Features", () => {
  let userId: number;

  /** Helper to insert a virtual collection directly via db. */
  async function insertCollection(name: string) {
    const [coll] = await db
      .insert(collectionTable)
      .values({ userId, displayName: name, name })
      .returning();
    return coll;
  }

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "flows@test.com" })
      .returning();
    userId = user.id;
  });

  it("should create a flow between two collections", async () => {
    const a = await insertCollection("collA");
    const b = await insertCollection("collB");

    const flow = await runTest(userId, createFlow(userId, { sourceId: a.id, targetId: b.id }));
    expect(flow.sourceId).toBe(a.id);
    expect(flow.targetId).toBe(b.id);
  });

  it("should reject self-referencing flow", async () => {
    const a = await insertCollection("collA");

    await expect(
      runTest(userId, createFlow(userId, { sourceId: a.id, targetId: a.id })),
    ).rejects.toThrow("Source and target collections must be different");
  });

  it("should reject flow to non-existent collection", async () => {
    const a = await insertCollection("collA");

    await expect(
      runTest(userId, createFlow(userId, { sourceId: a.id, targetId: 99999 })),
    ).rejects.toThrow("not found");
  });

  it("should detect direct cycle (A→B, B→A)", async () => {
    const a = await insertCollection("collA");
    const b = await insertCollection("collB");

    await runTest(userId, createFlow(userId, { sourceId: a.id, targetId: b.id }));

    await expect(
      runTest(userId, createFlow(userId, { sourceId: b.id, targetId: a.id })),
    ).rejects.toThrow("cycle");
  });

  it("should detect transitive cycle (A→B→C, C→A)", async () => {
    const a = await insertCollection("collA");
    const b = await insertCollection("collB");
    const c = await insertCollection("collC");

    await runTest(userId, createFlow(userId, { sourceId: a.id, targetId: b.id }));
    await runTest(userId, createFlow(userId, { sourceId: b.id, targetId: c.id }));

    await expect(
      runTest(userId, createFlow(userId, { sourceId: c.id, targetId: a.id })),
    ).rejects.toThrow("cycle");
  });

  it("should allow diamond DAG (A→B, A→C, B→D, C→D)", async () => {
    const a = await insertCollection("collA");
    const b = await insertCollection("collB");
    const c = await insertCollection("collC");
    const d = await insertCollection("collD");

    await runTest(userId, createFlow(userId, { sourceId: a.id, targetId: b.id }));
    await runTest(userId, createFlow(userId, { sourceId: a.id, targetId: c.id }));
    await runTest(userId, createFlow(userId, { sourceId: b.id, targetId: d.id }));

    const flow = await runTest(userId, createFlow(userId, { sourceId: c.id, targetId: d.id }));
    expect(flow.sourceId).toBe(c.id);
    expect(flow.targetId).toBe(d.id);
  });
});
