import { beforeEach, describe, expect, it } from "bun:test";
import { db } from "../../infra/db/db";
import {
  collectionTable,
  connectionTable,
  flowTable,
  incidentTable,
  userTable,
} from "../../infra/db/schema";
import { pack, unpack } from "msgpackr";
import { eq } from "drizzle-orm";
import { ConnectionType } from "@contfu/core";
import { FilterOperator, PropertyType, type CollectionSchema, type Filter } from "@contfu/svc-core";
import { IncidentType } from "@contfu/svc-core";
import { runTest } from "../../../test/effect-helpers";
import { processSchemaChange } from "./processSchemaChange";

describe("processSchemaChange", () => {
  let userId: number;
  let collectionId: number;
  let flowId: number;

  const oldSchema: CollectionSchema = {
    title: PropertyType.STRING,
    price: PropertyType.NUMBER,
    active: PropertyType.BOOLEAN,
  };

  beforeEach(async () => {
    await db.delete(incidentTable);
    await db.delete(flowTable);
    await db.delete(collectionTable);
    await db.delete(connectionTable);
    await db.delete(userTable);

    const [user] = await db
      .insert(userTable)
      .values({ name: "Test", email: "schema-sync-test@test.com" })
      .returning();
    userId = user.id;

    const [connection] = await db
      .insert(connectionTable)
      .values({ userId, type: ConnectionType.STRAPI, name: "Test Conn" })
      .returning();

    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId,
        connectionId: connection.id,
        displayName: "Articles",
        name: "articles",
        schema: pack(oldSchema),
      })
      .returning();
    collectionId = collection.id;

    const [target] = await db
      .insert(collectionTable)
      .values({ userId, displayName: "Target", name: "target" })
      .returning();

    const filters: Filter[] = [
      { property: "title", operator: FilterOperator.CONTAINS, value: "test" },
      { property: "price", operator: FilterOperator.GT, value: 50 },
    ];

    const [flow] = await db
      .insert(flowTable)
      .values({
        userId,
        sourceId: collectionId,
        targetId: target.id,
        schema: pack(oldSchema),
        filters: pack(filters),
      })
      .returning();
    flowId = flow.id;
  });

  it("updates collection schema", async () => {
    const newSchema: CollectionSchema = { ...oldSchema, extra: PropertyType.STRING };

    await runTest(userId, processSchemaChange(userId, collectionId, newSchema));

    const [col] = await db
      .select({ schema: collectionTable.schema })
      .from(collectionTable)
      .where(eq(collectionTable.id, collectionId));
    const stored = unpack(col.schema!) as CollectionSchema;
    expect(stored.extra).toBe(PropertyType.STRING);
  });

  it("creates incident when filters break due to removed property", async () => {
    // Remove "title" from schema — the CONTAINS filter on it becomes invalid
    const newSchema: CollectionSchema = { price: PropertyType.NUMBER, active: PropertyType.BOOLEAN };

    await runTest(userId, processSchemaChange(userId, collectionId, newSchema));

    const incidents = await db
      .select()
      .from(incidentTable)
      .where(eq(incidentTable.flowId, flowId));
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.SchemaIncompatible);
    expect(incidents[0].resolved).toBe(false);
  });

  it("creates incident when operator becomes invalid for new type", async () => {
    // Change "title" from STRING to BOOLEAN — CONTAINS is invalid for BOOLEAN
    const newSchema: CollectionSchema = {
      title: PropertyType.BOOLEAN,
      price: PropertyType.NUMBER,
      active: PropertyType.BOOLEAN,
    };

    await runTest(userId, processSchemaChange(userId, collectionId, newSchema));

    const incidents = await db
      .select()
      .from(incidentTable)
      .where(eq(incidentTable.flowId, flowId));
    expect(incidents).toHaveLength(1);
  });

  it("auto-resolves incidents when schema is compatible", async () => {
    // First, create a breaking change
    const brokenSchema: CollectionSchema = { price: PropertyType.NUMBER };
    await runTest(userId, processSchemaChange(userId, collectionId, brokenSchema));

    let incidents = await db
      .select()
      .from(incidentTable)
      .where(eq(incidentTable.flowId, flowId));
    expect(incidents).toHaveLength(1);

    // Now fix the schema — add back all properties so filters are valid
    const fixedSchema: CollectionSchema = {
      title: PropertyType.STRING,
      price: PropertyType.NUMBER,
      active: PropertyType.BOOLEAN,
    };
    await runTest(userId, processSchemaChange(userId, collectionId, fixedSchema));

    incidents = await db.select().from(incidentTable).where(eq(incidentTable.flowId, flowId));
    expect(incidents).toHaveLength(0);
  });

  it("does nothing for flows without filters", async () => {
    // Create a flow without filters
    const [target2] = await db
      .insert(collectionTable)
      .values({ userId, displayName: "Target2", name: "target2" })
      .returning();
    await db.insert(flowTable).values({
      userId,
      sourceId: collectionId,
      targetId: target2.id,
      schema: pack(oldSchema),
    });

    const newSchema: CollectionSchema = { changed: PropertyType.BOOLEAN };
    await runTest(userId, processSchemaChange(userId, collectionId, newSchema));

    // Only the flow with filters should have an incident
    const incidents = await db.select().from(incidentTable);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].flowId).toBe(flowId);
  });
});
