/**
 * Schema resync E2E test seed data.
 * Creates a target collection with a flow from a source collection and a consumer
 * collection connected via another flow, so schema-update broadcasts and resync
 * enqueuing can be verified.
 */
import { ConnectionType, PropertyType } from "@contfu/svc-core";
import {
  collectionTable,
  connectionTable,
  flowTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { pack } from "msgpackr";
import { eq } from "drizzle-orm";
import type { CollectionSchema, MappingRule } from "@contfu/svc-core";
import { hashKeyForStorage } from "./seed-utils";

/** Well-known consumer key for schema-resync tests. */
export const SCHEMA_RESYNC_CONSUMER_KEY = Buffer.from("00000000000000000000000000000004", "hex");

/** Well-known consumer name for schema-resync tests. */
export const SCHEMA_RESYNC_CONSUMER_NAME = "Schema Resync Consumer";

export const SCHEMA_RESYNC_COLLECTION_NAME = "schemaResyncCollection";

/** Initial target schema. */
export const INITIAL_TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
};

/** Updated target schema — used in the test to trigger a resync. */
export const UPDATED_TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  body: PropertyType.STRING,
};

/** Source schema. */
export const SOURCE_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  body: PropertyType.STRING,
};

/** Mappings for the flow. */
export const MAPPINGS: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "body", target: "body" },
];

export async function seedSchemaResyncData(db: any): Promise<void> {
  let [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, "test@test.com"))
    .limit(1);

  if (!user) return;
  const userId = user.id;

  // Idempotent check — look for client connection by name
  const [existing] = await db
    .select({ id: connectionTable.id })
    .from(connectionTable)
    .where(eq(connectionTable.name, "Schema Resync Client"))
    .limit(1);

  if (existing) return;

  // Source connection (Strapi)
  const [sourceConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.STRAPI,
      name: "Schema Resync Connection",
    })
    .returning({ id: connectionTable.id });
  if (!sourceConnection) return;

  // Source collection
  const [sourceCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Schema Resync Source Collection",
      displayName: "Schema Resync Source Collection",
      schema: pack(SOURCE_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!sourceCollection) return;

  // Target collection
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      name: SCHEMA_RESYNC_COLLECTION_NAME,
      displayName: "Schema Resync Collection",
      schema: pack(INITIAL_TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Flow: source → target
  await db.insert(flowTable).values({
    userId,
    sourceId: sourceCollection.id,
    targetId: targetCollection.id,
    schema: pack(SOURCE_SCHEMA),
    mappings: pack(MAPPINGS),
  });

  // Client connection for consumer
  const [clientConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.APP,
      name: "Schema Resync Client",
      credentials: hashKeyForStorage(SCHEMA_RESYNC_CONSUMER_KEY),
    })
    .returning({ id: connectionTable.id });
  if (!clientConnection) return;

  // Consumer collection — named to match target so COLLECTION_SCHEMA events
  // carry the expected collection name on the sync stream.
  const [consumerCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: clientConnection.id,
      name: SCHEMA_RESYNC_COLLECTION_NAME,
      displayName: "Schema Resync Client",
    })
    .returning({ id: collectionTable.id });
  if (!consumerCollection) return;

  // Flow: target → consumer collection
  await db.insert(flowTable).values({
    userId,
    sourceId: targetCollection.id,
    targetId: consumerCollection.id,
  });
}
