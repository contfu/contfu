import type { RequestHandler } from "./$types";
import { SourceType } from "@contfu/core";
import { db, sourceTable, collectionTable, connectionTable } from "$lib/server/db/db";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";

/** Strapi webhook event types we handle. */
type StrapiEvent =
  | "entry.create"
  | "entry.update"
  | "entry.delete"
  | "entry.publish"
  | "entry.unpublish";

/** Strapi webhook payload structure. */
interface StrapiWebhookPayload {
  event: StrapiEvent;
  createdAt: string;
  model: string;
  uid?: string;
  entry: {
    id: number;
    documentId?: string;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    [key: string]: unknown;
  };
}

/**
 * Validates HMAC signature if webhook secret is configured.
 * Uses X-Strapi-Signature header (custom) or validates timestamp + payload.
 */
function validateSignature(
  body: string,
  headers: Headers,
  secret: string | null,
): boolean {
  if (!secret) return true; // No secret configured, skip validation

  const signature = headers.get("x-strapi-signature") || headers.get("x-webhook-signature");
  const timestamp = headers.get("x-strapi-timestamp") || headers.get("x-webhook-timestamp");

  if (!signature) return false;

  // Compute expected signature
  const payload = timestamp ? `${timestamp}.${body}` : body;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expected = `sha256=${hmac.digest("hex")}`;

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export const POST: RequestHandler = async ({ request, params }) => {
  const sourceId = parseInt(params.sourceId, 10);
  if (!Number.isFinite(sourceId)) {
    return new Response("Invalid source ID", { status: 400 });
  }

  // Parse the webhook payload
  const body = await request.text();
  let payload: StrapiWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error("[Strapi webhook] Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  // Validate required fields
  if (!payload.event || !payload.model || !payload.entry) {
    console.error("[Strapi webhook] Missing required fields:", { event: payload.event, model: payload.model });
    return new Response("Missing required fields", { status: 400 });
  }

  // Get the event type from header (more reliable than payload)
  const eventType = request.headers.get("x-strapi-event") || payload.event;

  console.log(`[Strapi webhook] Received ${eventType} for model "${payload.model}", entry ${payload.entry.id}`);

  // Find the source and verify it's a Strapi source
  // We need to find by URL since webhooks come from the Strapi instance
  // The sourceId in the URL is user-scoped, so we need to find which user owns it
  const sources = await db
    .select({
      userId: sourceTable.userId,
      id: sourceTable.id,
      type: sourceTable.type,
      url: sourceTable.url,
      webhookSecret: sourceTable.webhookSecret,
    })
    .from(sourceTable)
    .where(and(eq(sourceTable.id, sourceId), eq(sourceTable.type, SourceType.STRAPI)));

  if (sources.length === 0) {
    console.error(`[Strapi webhook] Source ${sourceId} not found or not a Strapi source`);
    return new Response("Source not found", { status: 404 });
  }

  // For each matching source (there could be multiple users with same source ID),
  // validate signature and trigger sync
  for (const source of sources) {
    // Validate webhook signature if secret is configured
    if (source.webhookSecret) {
      const webhookSecret = source.webhookSecret.toString("utf8");
      if (!validateSignature(body, request.headers, webhookSecret)) {
        console.error(`[Strapi webhook] Invalid signature for source ${source.userId}:${source.id}`);
        continue; // Skip this source, try others
      }
    }

    // Find collections that use this source and match the content type
    // The collection ref stores the content type UID (e.g., "api::article.article")
    const contentTypeUid = payload.uid || `api::${payload.model}.${payload.model}`;
    const refBuffer = Buffer.from(contentTypeUid, "utf8");

    const collections = await db
      .select({ id: collectionTable.id })
      .from(collectionTable)
      .where(
        and(
          eq(collectionTable.userId, source.userId),
          eq(collectionTable.sourceId, source.id),
          eq(collectionTable.ref, refBuffer),
        ),
      );

    if (collections.length === 0) {
      console.log(`[Strapi webhook] No collections found for content type "${contentTypeUid}" in source ${source.userId}:${source.id}`);
      continue;
    }

    // Reset lastItemChanged for all connections to these collections
    // This triggers a resync on the next worker poll
    const collectionIds = collections.map((c) => c.id);

    // Calculate the timestamp to sync from (a few seconds before the event)
    const eventTime = new Date(payload.createdAt || payload.entry.updatedAt).getTime();
    const syncFrom = Math.floor(eventTime / 1000) - 10; // 10 seconds buffer

    for (const collectionId of collectionIds) {
      await db
        .update(connectionTable)
        .set({ lastItemChanged: syncFrom })
        .where(
          and(
            eq(connectionTable.userId, source.userId),
            eq(connectionTable.collectionId, collectionId),
            // Only reset if current lastItemChanged is newer than syncFrom
            sql`${connectionTable.lastItemChanged} IS NULL OR ${connectionTable.lastItemChanged} > ${syncFrom}`,
          ),
        );
    }

    console.log(
      `[Strapi webhook] Triggered resync for ${collections.length} collection(s) in source ${source.userId}:${source.id}`,
    );
  }

  return new Response("OK", { status: 200 });
};
