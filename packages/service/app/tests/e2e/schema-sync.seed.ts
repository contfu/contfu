/**
 * Schema-sync E2E test seed data.
 * Sets up a Notion source with schema + flow with filters that will break
 * when the mock server returns an incompatible schema.
 */
import {
  ConnectionType,
  PropertyType,
  FilterOperator,
  type Filter,
  type CollectionSchema,
} from "@contfu/svc-core";
import { pack } from "msgpackr";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import {
  collectionTable,
  connectionTable,
  flowTable,
  userTable,
} from "@contfu/svc-backend/infra/db/schema";
import { and, eq } from "drizzle-orm";

/** Well-known UID for the schema-sync test connection. */
export const SCHEMA_SYNC_UID = "00000003-0000-4000-a000-000000000003";

/** Database ID used by mock data source responses. Must match mock-notion-server. */
export const SCHEMA_SYNC_DB_ID = "22222222-3333-4444-5555-666666666666";

/** Data source IDs — mock server returns different schemas for each. */
export const SCHEMA_BREAK_DS_ID = "ffffffff-bbbb-cccc-dddd-111111111111";
export const SCHEMA_FIX_DS_ID = "ffffffff-bbbb-cccc-dddd-222222222222";

const MOCK_TOKEN = "mock-notion-token";

/** The initial schema has both title and status. */
const INITIAL_SCHEMA: CollectionSchema = {
  cover: PropertyType.FILE | PropertyType.NULL,
  icon: PropertyType.FILE | PropertyType.NULL,
  title: PropertyType.STRING | PropertyType.NULL,
  status: PropertyType.STRING | PropertyType.NULL,
};

/**
 * Seeds the schema-sync test pipeline:
 * connection (Notion source) → source collection (with schema) → target collection → flow (with filters)
 */
export async function seedSchemaSyncData(db: any): Promise<void> {
  let [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, "test@test.com"))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "test@test.com",
        emailVerified: true,
        approved: true,
      })
      .returning({ id: userTable.id });
  }

  if (!user) return;
  const userId = user.id;

  // Idempotent check
  const [existing] = await db
    .select({ id: connectionTable.id })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.uid, SCHEMA_SYNC_UID)))
    .limit(1);

  if (existing) return;

  const encryptedCredentials = await encryptCredentials(userId, Buffer.from(MOCK_TOKEN, "utf8"));

  // Source connection (Notion)
  const [sourceConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.NOTION,
      name: "Schema Sync Test Connection",
      credentials: encryptedCredentials,
      uid: SCHEMA_SYNC_UID,
    })
    .returning({ id: connectionTable.id });
  if (!sourceConnection) return;

  // Source collection with schema and ref matching mock DB ID
  const ref = Buffer.from(SCHEMA_SYNC_DB_ID.replace(/-/g, ""), "hex");
  const [sourceCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Schema Sync Source",
      displayName: "Schema Sync Source",
      ref,
      schema: pack(INITIAL_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!sourceCollection) return;

  // Target collection
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      displayName: "Schema Sync Target",
      name: "Schema Sync Target",
      schema: pack({}),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Flow with a filter on "status" — will break when status is removed from schema
  const filters: Filter[] = [
    { property: "status", operator: FilterOperator.EQ, value: "published" },
  ];

  await db.insert(flowTable).values({
    userId,
    sourceId: sourceCollection.id,
    targetId: targetCollection.id,
    schema: pack(INITIAL_SCHEMA),
    filters: pack(filters),
  });
}
