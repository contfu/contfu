import type { RequestHandler } from "./$types";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload";
import type { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload";
import type { WebhookSubscriptionCanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload";
import { db } from "@contfu/svc-backend/infra/db/db";
import { quotaTable } from "@contfu/svc-backend/infra/db/schema";
import { getQuotaForProduct } from "@contfu/svc-backend/infra/polar/products";
import { eq } from "drizzle-orm";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text();
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET ?? "";

  try {
    const event = validateEvent(body, Object.fromEntries(request.headers), webhookSecret);

    switch (event.type) {
      case "subscription.created":
      case "subscription.updated": {
        const payload = event.data as
          | WebhookSubscriptionCreatedPayload["data"]
          | WebhookSubscriptionUpdatedPayload["data"];
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
              maxSources: quota.maxSources,
              maxCollections: quota.maxCollections,
              maxItems: quota.maxItems,
              maxConsumers: quota.maxConsumers,
            })
            .where(eq(quotaTable.polarCustomerId, customerId));
        }
        break;
      }

      case "subscription.revoked":
      case "subscription.canceled": {
        const payload = event.data as
          | WebhookSubscriptionRevokedPayload["data"]
          | WebhookSubscriptionCanceledPayload["data"];
        const customerId = payload.customerId;

        // Reset to free quota
        const quota = getQuotaForProduct(null);
        await db
          .update(quotaTable)
          .set({
            subscriptionId: null,
            subscriptionStatus: "canceled",
            currentPeriodEnd: null,
            maxSources: quota.maxSources,
            maxCollections: quota.maxCollections,
            maxItems: quota.maxItems,
            maxConsumers: quota.maxConsumers,
          })
          .where(eq(quotaTable.polarCustomerId, customerId));
        break;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.error("Webhook verification failed:", error.message);
      return new Response("Invalid signature", { status: 400 });
    }
    console.error("Webhook error:", error);
    return new Response("Internal error", { status: 500 });
  }
};
