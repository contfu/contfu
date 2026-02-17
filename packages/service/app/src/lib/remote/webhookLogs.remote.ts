import { query } from "$app/server";
import { getUserId } from "$lib/server/user";
import { db } from "@contfu/svc-backend/infra/db/db";
import { webhookLogTable } from "@contfu/svc-backend/infra/db/schema";
import { idSchema } from "@contfu/svc-backend/infra/ids";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";

/**
 * WebhookLogEntry type for the UI.
 */
export interface WebhookLogEntry {
  id: number;
  event: string;
  model: string | null;
  status: "success" | "error" | "unauthorized";
  errorMessage: string | null;
  itemsBroadcast: number;
  timestamp: Date;
}

/**
 * Get webhook logs for a source.
 */
export const getWebhookLogs = query(
  v.object({
    sourceId: idSchema("source"),
    limit: v.optional(v.number(), 20),
  }),
  async ({ sourceId, limit }): Promise<WebhookLogEntry[]> => {
    const userId = getUserId();

    const logs = await db
      .select()
      .from(webhookLogTable)
      .where(and(eq(webhookLogTable.sourceId, sourceId)))
      .orderBy(desc(webhookLogTable.timestamp))
      .limit(limit ?? 20);

    return logs.map((log) => ({
      id: log.id,
      event: log.event,
      model: log.model,
      status: log.status as "success" | "error" | "unauthorized",
      errorMessage: log.errorMessage,
      itemsBroadcast: log.itemsBroadcast,
      timestamp: log.timestamp,
    }));
  },
);
