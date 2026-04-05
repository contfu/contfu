/**
 * Selective flow resync E2E test seed data.
 *
 * Creates a target collection with TWO flows from different mock-Strapi source
 * collections (articles + posts), a consumer connection + collection, and a flow
 * (target→consumer).
 * The test changes mappings on only one flow and verifies that a resync
 * is triggered (items arrive with the new mapping applied).
 */
import { ConnectionType, PropertyType } from "@contfu/svc-core";
import { encryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
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

/** Well-known consumer key for selective resync tests. */
export const SELECTIVE_RESYNC_CONSUMER_KEY = Buffer.from("00000000000000000000000000000005", "hex");

/** Well-known consumer name. */
export const SELECTIVE_RESYNC_CONSUMER_NAME = "Selective Resync Consumer";

export const COLLECTION_NAME = "selectiveResyncCollection";

/** Target schema. */
export const TARGET_SCHEMA: CollectionSchema = {
  title: PropertyType.STRING,
  score: PropertyType.STRING,
};

/** Source A schema (articles): title + views. */
export const SOURCE_SCHEMA_A: CollectionSchema = {
  title: PropertyType.STRING,
  views: PropertyType.NUMBER,
};

/** Source B schema (posts): heading + rating. */
export const SOURCE_SCHEMA_B: CollectionSchema = {
  heading: PropertyType.STRING,
  rating: PropertyType.NUMBER,
};

/** Mappings for flow A: title->title, views->score (cast string). */
export const MAPPINGS_A: MappingRule[] = [
  { source: "title", target: "title" },
  { source: "views", target: "score", cast: "string" },
];

/** Mappings for flow B: heading->title, rating->score (cast string). */
export const MAPPINGS_B: MappingRule[] = [
  { source: "heading", target: "title" },
  { source: "rating", target: "score", cast: "string" },
];

export async function seedSelectiveResyncData(db: any): Promise<void> {
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
    .where(eq(connectionTable.name, "Selective Resync Client"))
    .limit(1);

  if (existing) return;

  // Source connection (Strapi)
  const encCreds = await encryptCredentials(userId, Buffer.from("mock-strapi-token", "utf-8"));
  const [sourceConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.STRAPI,
      name: "Mock Strapi Connection (selective-resync)",
      credentials: encCreds,
      url: "http://localhost:4175",
    })
    .returning({ id: connectionTable.id });
  if (!sourceConnection) return;

  // Source collection A: articles
  const [srcColA] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Articles (selective)",
      displayName: "Articles (selective)",
      ref: Buffer.from("api::article.article", "utf-8"),
      schema: pack(SOURCE_SCHEMA_A),
    })
    .returning({ id: collectionTable.id });
  if (!srcColA) return;

  // Source collection B: posts
  const [srcColB] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: sourceConnection.id,
      name: "Posts (selective)",
      displayName: "Posts (selective)",
      ref: Buffer.from("api::post.post", "utf-8"),
      schema: pack(SOURCE_SCHEMA_B),
    })
    .returning({ id: collectionTable.id });
  if (!srcColB) return;

  // Target collection
  const [targetCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      name: COLLECTION_NAME,
      displayName: "Selective Resync Collection",
      schema: pack(TARGET_SCHEMA),
    })
    .returning({ id: collectionTable.id });
  if (!targetCollection) return;

  // Flow A: articles -> target collection
  await db.insert(flowTable).values({
    userId,
    sourceId: srcColA.id,
    targetId: targetCollection.id,
    schema: pack(SOURCE_SCHEMA_A),
    mappings: pack(MAPPINGS_A),
  });

  // Flow B: posts -> target collection
  await db.insert(flowTable).values({
    userId,
    sourceId: srcColB.id,
    targetId: targetCollection.id,
    schema: pack(SOURCE_SCHEMA_B),
    mappings: pack(MAPPINGS_B),
  });

  // Client connection for consumer
  const [clientConnection] = await db
    .insert(connectionTable)
    .values({
      userId,
      type: ConnectionType.APP,
      name: "Selective Resync Client",
      credentials: hashKeyForStorage(SELECTIVE_RESYNC_CONSUMER_KEY),
    })
    .returning({ id: connectionTable.id });
  if (!clientConnection) return;

  // Consumer collection — name matches target for sync stream events,
  // but displayName differs to avoid duplicate links on the collections page.
  const [consumerCollection] = await db
    .insert(collectionTable)
    .values({
      userId,
      connectionId: clientConnection.id,
      name: COLLECTION_NAME,
      displayName: "Selective Resync Client",
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
