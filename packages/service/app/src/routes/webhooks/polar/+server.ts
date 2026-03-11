import type { RequestHandler } from "./$types";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { db } from "@contfu/svc-backend/infra/db/db";
import { quotaTable } from "@contfu/svc-backend/infra/db/schema";
import { getQuotaForProduct } from "@contfu/svc-backend/infra/polar/products";
import { setLimits } from "@contfu/svc-backend/infra/nats/quota-kv";
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
          await setLimits(existing[0].id, quota, currentPeriodEnd);
        }
        break;
      }

      case "subscription.revoked":
      case "subscription.canceled": {
        const payload = event.data;
        const customerId = payload.customerId;

        // Reset to free quota
        const quota = getQuotaForProduct(null);
        const existingRow = await db
          .select()
          .from(quotaTable)
          .where(eq(quotaTable.polarCustomerId, customerId))
          .limit(1);
        await db
          .update(quotaTable)
          .set({
            subscriptionId: null,
            subscriptionStatus: "canceled",
            currentPeriodEnd: null,
            maxConnections: quota.maxConnections,
            maxCollections: quota.maxCollections,
            maxItems: quota.maxItems,
          })
          .where(eq(quotaTable.polarCustomerId, customerId));
        if (existingRow.length > 0) {
          await setLimits(existingRow[0].id, quota, null);
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
