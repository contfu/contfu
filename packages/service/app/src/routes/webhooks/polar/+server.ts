import type { RequestHandler } from "./$types";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { db } from "@contfu/svc-backend/infra/db/db";
import { quotaTable, userTable } from "@contfu/svc-backend/infra/db/schema";
import {
  getQuotaForProduct,
  getQuotaForTier,
  PlanTier,
} from "@contfu/svc-backend/infra/polar/products";
import { publishLimitChange } from "@contfu/svc-backend/infra/cache/quota-cache";
import { eq } from "drizzle-orm";

const log = createLogger("webhook-polar");

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text();
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET ?? "";

  try {
    const event = validateEvent(body, Object.fromEntries(request.headers), webhookSecret);

    switch (event.type) {
      case "subscription.created":
      case "subscription.updated": {
        const payload = event.data;
        const customerId = payload.customerId;
        const productId = payload.productId;
        const status = payload.status;
        const currentPeriodEnd = payload.currentPeriodEnd
          ? new Date(payload.currentPeriodEnd)
          : null;

        // Find user by Polar customer ID
        const existing = await db
          .select()
          .from(quotaTable)
          .where(eq(quotaTable.polarCustomerId, customerId))
          .limit(1);

        if (existing.length > 0) {
          const quota = getQuotaForProduct(productId);
          await db
            .update(quotaTable)
            .set({
              subscriptionId: payload.id,
              subscriptionStatus: status,
              currentPeriodEnd,
              maxConnections: quota.maxConnections,
              maxCollections: quota.maxCollections,
              maxFlows: quota.maxFlows,
              maxItems: quota.maxItems,
            })
            .where(eq(quotaTable.polarCustomerId, customerId));
          publishLimitChange(existing[0].id, {
            maxConnections: quota.maxConnections,
            maxCollections: quota.maxCollections,
            maxFlows: quota.maxFlows,
            maxItems: quota.maxItems,
            periodEnd: currentPeriodEnd ? Math.floor(currentPeriodEnd.getTime() / 1000) : 0,
          });
        }
        break;
      }

      case "subscription.revoked":
      case "subscription.canceled": {
        const payload = event.data;
        const customerId = payload.customerId;

        // Reset to user's base plan quota
        const existingRow = await db
          .select({ id: quotaTable.id, basePlan: userTable.basePlan })
          .from(quotaTable)
          .innerJoin(userTable, eq(quotaTable.id, userTable.id))
          .where(eq(quotaTable.polarCustomerId, customerId))
          .limit(1);
        const basePlan = existingRow[0]?.basePlan ?? PlanTier.FREE;
        const quota = getQuotaForTier(basePlan);
        await db
          .update(quotaTable)
          .set({
            subscriptionId: null,
            subscriptionStatus: "canceled",
            currentPeriodEnd: null,
            maxConnections: quota.maxConnections,
            maxCollections: quota.maxCollections,
            maxFlows: quota.maxFlows,
            maxItems: quota.maxItems,
          })
          .where(eq(quotaTable.polarCustomerId, customerId));
        if (existingRow.length > 0) {
          publishLimitChange(existingRow[0].id, {
            maxConnections: quota.maxConnections,
            maxCollections: quota.maxCollections,
            maxFlows: quota.maxFlows,
            maxItems: quota.maxItems,
            periodEnd: 0,
          });
        }
        break;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      log.warn({ message: error.message }, "Webhook verification failed");
      return new Response("Invalid signature", { status: 400 });
    }
    log.error({ err: error }, "Webhook error");
    return new Response("Internal error", { status: 500 });
  }
};
