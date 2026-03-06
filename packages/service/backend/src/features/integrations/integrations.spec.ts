import { beforeEach, describe, expect, it } from "bun:test";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { userTable } from "../../infra/db/schema";
import { createIntegration } from "./createIntegration";
import { deleteIntegration } from "./deleteIntegration";
import { getIntegrationWithCredentials } from "./getIntegrationWithCredentials";
import { listIntegrations } from "./listIntegrations";
import { renameIntegration } from "./renameIntegration";

describe("Integration Features", () => {
  let userId: number;
  let otherUserId: number;

  beforeEach(async () => {
    await truncateAllTables();

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test User", email: "integrations@test.com" })
      .returning();
    userId = user.id;

    const [other] = await db
      .insert(userTable)
      .values({ name: "Other User", email: "other@test.com" })
      .returning();
    otherUserId = other.id;
  });

  it("should create and list integrations", async () => {
    const created = await runTest(
      createIntegration(userId, {
        providerId: "notion",
        label: "Notion",
        accountId: "workspace-123",
        credentials: Buffer.from("token-abc"),
      }),
    );

    expect(created.providerId).toBe("notion");
    expect(created.label).toBe("Notion");
    expect(created.accountId).toBe("workspace-123");
    expect(created.hasCredentials).toBe(true);

    const all = await runTest(listIntegrations(userId));
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
  });

  it("should decrypt credentials via getIntegrationWithCredentials", async () => {
    const created = await runTest(
      createIntegration(userId, {
        providerId: "notion",
        label: "Notion",
        credentials: Buffer.from("secret-token"),
      }),
    );

    const internal = await runTest(getIntegrationWithCredentials(userId, created.id));
    expect(internal).toBeDefined();
    expect(internal!.credentials).toEqual(Buffer.from("secret-token"));
  });

  it("should rename an integration", async () => {
    const created = await runTest(
      createIntegration(userId, {
        providerId: "notion",
        label: "Notion",
      }),
    );

    const renamed = await runTest(renameIntegration(userId, created.id, "My Workspace"));
    expect(renamed).toBeDefined();
    expect(renamed!.label).toBe("My Workspace");
  });

  it("should delete an integration", async () => {
    const created = await runTest(
      createIntegration(userId, {
        providerId: "notion",
        label: "Notion",
      }),
    );

    const deleted = await runTest(deleteIntegration(userId, created.id));
    expect(deleted).toBe(true);

    const all = await runTest(listIntegrations(userId));
    expect(all).toHaveLength(0);
  });

  it("should isolate integrations by user (RLS)", async () => {
    await runTest(
      createIntegration(userId, {
        providerId: "notion",
        label: "User 1 Notion",
      }),
    );

    await runTest(
      createIntegration(otherUserId, {
        providerId: "notion",
        label: "User 2 Notion",
      }),
    );

    const user1List = await runTest(listIntegrations(userId));
    expect(user1List).toHaveLength(1);
    expect(user1List[0].label).toBe("User 1 Notion");

    const user2List = await runTest(listIntegrations(otherUserId));
    expect(user2List).toHaveLength(1);
    expect(user2List[0].label).toBe("User 2 Notion");
  });

  it("should not allow deleting another user's integration", async () => {
    const created = await runTest(
      createIntegration(userId, {
        providerId: "notion",
        label: "My Notion",
      }),
    );

    const deleted = await runTest(deleteIntegration(otherUserId, created.id));
    expect(deleted).toBe(false);
  });
});
