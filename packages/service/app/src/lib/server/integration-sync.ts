import { createIntegration } from "@contfu/svc-backend/features/integrations/createIntegration";
import { runWithUser } from "$lib/server/run";
import { db } from "@contfu/svc-backend/infra/db/db";
import { integrationTable } from "@contfu/svc-backend/infra/db/schema";
import { and, eq } from "drizzle-orm";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";

const log = createLogger("integration-sync");

async function resolveLabel(
  providerId: string,
  accountId: string,
  accessToken: string,
): Promise<string> {
  const fallback = `${providerId.charAt(0).toUpperCase() + providerId.slice(1)} (${accountId.slice(0, 6)})`;
  if (providerId !== "notion") return fallback;
  try {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const name = data?.bot?.workspace_name;
    return typeof name === "string" && name.length > 0 ? name : fallback;
  } catch (err) {
    log.warn({ err, providerId }, "Failed to fetch workspace name");
    return fallback;
  }
}

/**
 * Upsert an integration row when a social account is linked via OAuth.
 * If an integration already exists for this user+provider+accountId, update its credentials.
 * Otherwise create a new one.
 */
export async function upsertIntegrationFromOAuth(
  userId: number,
  providerId: string,
  accountId: string,
  accessToken: string,
) {
  try {
    // Check for existing integration with same provider + accountId
    const [existing] = await db
      .select({ id: integrationTable.id })
      .from(integrationTable)
      .where(
        and(
          eq(integrationTable.userId, userId),
          eq(integrationTable.providerId, providerId),
          eq(integrationTable.accountId, accountId),
        ),
      )
      .limit(1);

    if (existing) {
      // Update credentials on re-auth — import crypto to encrypt
      const { encryptCredentials } = await import("@contfu/svc-backend/infra/crypto/credentials");
      const encrypted = await encryptCredentials(userId, Buffer.from(accessToken, "utf-8"));
      await db
        .update(integrationTable)
        .set({ credentials: encrypted, updatedAt: new Date() })
        .where(eq(integrationTable.id, existing.id));
      log.debug(
        { userId, providerId, integrationId: existing.id },
        "Updated integration credentials",
      );
    } else {
      const label = await resolveLabel(providerId, accountId, accessToken);
      await runWithUser(
        userId,
        createIntegration(userId, {
          providerId,
          label,
          accountId,
          credentials: Buffer.from(accessToken, "utf-8"),
        }),
      );
      log.debug({ userId, providerId, label }, "Created integration from OAuth");
    }
  } catch (err) {
    log.error({ err, userId, providerId }, "Failed to upsert integration from OAuth");
  }
}
