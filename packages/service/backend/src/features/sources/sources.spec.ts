import { SourceType } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import { runTest } from "../../../test/effect-helpers";
import { truncateAllTables } from "../../../test/setup";
import { db } from "../../infra/db/db";
import { sourceCollectionTable, userTable } from "../../infra/db/schema";
import { createIntegration } from "../integrations/createIntegration";
import { createSource } from "./createSource";
import { deleteSource } from "./deleteSource";
import { getSource } from "./getSource";
import { getSourceWithCollectionCount } from "./getSourceWithCollectionCount";
import { getSourceWithCredentials } from "./getSourceWithCredentials";
import { listSources } from "./listSources";
import { updateSource } from "./updateSource";

describe("Source Features Happy Path", () => {
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
    const created = await runTest(
      createSource(userId, {
        name: "My Strapi Source",
        type: SourceType.STRAPI,
        url: "https://strapi.example.com",
      }),
    );

    const fetched = await runTest(getSource(userId, created.id));
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.name).toBe("My Strapi Source");
    expect(fetched!.hasCredentials).toBe(false);
  });

  it("should update and delete a source", async () => {
    const created = await runTest(
      createSource(userId, {
        name: "Old Name",
        type: SourceType.STRAPI,
        url: "https://old.example.com",
      }),
    );

    const updated = await runTest(
      updateSource(userId, created.id, {
        name: "New Name",
        url: "https://new.example.com",
      }),
    );

    expect(updated).toBeDefined();
    expect(updated!.name).toBe("New Name");
    expect(updated!.url).toBe("https://new.example.com");

    const deleted = await runTest(deleteSource(userId, created.id));
    expect(deleted).toBe(true);

    const afterDelete = await runTest(getSource(userId, created.id));
    expect(afterDelete).toBeUndefined();
  });

  it("should decrypt credentials via getSourceWithCredentials", async () => {
    const created = await runTest(
      createSource(userId, {
        name: "Secret Source",
        type: SourceType.STRAPI,
        url: "https://strapi.example.com",
        credentials: Buffer.from("token-123"),
        webhookSecret: Buffer.from("whsec-456"),
      }),
    );

    const internal = await runTest(getSourceWithCredentials(userId, created.id));
    expect(internal).toBeDefined();
    expect(internal!.credentials).toEqual(Buffer.from("token-123"));
    expect(internal!.webhookSecret).toEqual(Buffer.from("whsec-456"));
  });

  it("should list sources with collection counts", async () => {
    const source1 = await runTest(
      createSource(userId, {
        name: "Source 1",
        type: SourceType.STRAPI,
        url: "https://one.example.com",
      }),
    );
    const source2 = await runTest(
      createSource(userId, {
        name: "Source 2",
        type: SourceType.STRAPI,
        url: "https://two.example.com",
      }),
    );

    await db.insert(sourceCollectionTable).values([
      { userId, sourceId: source1.id, name: "Articles" },
      { userId, sourceId: source1.id, name: "Pages" },
      { userId, sourceId: source2.id, name: "Posts" },
    ]);

    const all = await runTest(listSources(userId));
    expect(all).toHaveLength(2);

    const byId = new Map(all.map((s) => [s.id, s.collectionCount]));
    expect(byId.get(source1.id)).toBe(2);
    expect(byId.get(source2.id)).toBe(1);

    const one = await runTest(getSourceWithCollectionCount(userId, source1.id));
    expect(one).toBeDefined();
    expect(one!.collectionCount).toBe(2);
  });

  it("should create source with integrationId", async () => {
    const source = await runTest(
      createSource(userId, {
        name: "N",
        type: SourceType.NOTION,
        integrationId: null,
      }),
    );

    expect(source.integrationId).toBeNull();
  });

  it("should return null integrationId when not set", async () => {
    const source = await runTest(
      createSource(userId, {
        name: "My Strapi",
        type: SourceType.STRAPI,
        url: "https://strapi.example.com",
      }),
    );

    expect(source.integrationId).toBeNull();
  });

  it("should resolve credentials from linked integration", async () => {
    const integration = await runTest(
      createIntegration(userId, {
        providerId: "notion",
        label: "My Workspace",
        credentials: Buffer.from("oauth-token-xyz"),
      }),
    );

    const source = await runTest(
      createSource(userId, {
        name: "Notion via OAuth",
        type: SourceType.NOTION,
        integrationId: integration.id,
      }),
    );

    expect(source.hasCredentials).toBe(false);
    expect(source.integrationId).toBe(integration.id);

    const internal = await runTest(getSourceWithCredentials(userId, source.id));
    expect(internal).toBeDefined();
    expect(internal!.credentials).toEqual(Buffer.from("oauth-token-xyz"));
  });

  it("should return null credentials when source has no integration and no inline credentials", async () => {
    const source = await runTest(
      createSource(userId, {
        name: "No Creds",
        type: SourceType.NOTION,
      }),
    );

    const internal = await runTest(getSourceWithCredentials(userId, source.id));
    expect(internal).toBeDefined();
    expect(internal!.credentials).toBeNull();
  });

  it("should prefer inline credentials over integration", async () => {
    const integration = await runTest(
      createIntegration(userId, {
        providerId: "notion",
        label: "Workspace",
        credentials: Buffer.from("integration-token"),
      }),
    );

    const source = await runTest(
      createSource(userId, {
        name: "Notion with both",
        type: SourceType.NOTION,
        credentials: Buffer.from("inline-token"),
        integrationId: integration.id,
      }),
    );

    const internal = await runTest(getSourceWithCredentials(userId, source.id));
    expect(internal).toBeDefined();
    expect(internal!.credentials).toEqual(Buffer.from("inline-token"));
  });
});
