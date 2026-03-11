import { ConnectionType } from "@contfu/core";
import { and, eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { connectionTable } from "../../infra/db/schema";
import { encryptCredentials } from "../../infra/crypto/credentials";
import { createLogger } from "../../infra/logger/index";
import { createConnection } from "./createConnection";

const log = createLogger("oauth-connection");

const typeMap: Record<string, ConnectionType> = {
  notion: ConnectionType.NOTION,
  strapi: ConnectionType.STRAPI,
  contentful: ConnectionType.CONTENTFUL,
  web: ConnectionType.WEB,
};

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
 * Upsert a connection row when a social account is linked via OAuth.
 * If a connection already exists for this user+provider+accountId, update its credentials.
 * Otherwise create a new one via the provided `runEffect` callback (which executes the Effect
 * within the app's managed runtime).
 */
export async function saveOAuthConnection(
  userId: number,
  providerId: string,
  accountId: string,
  accessToken: string,
  runEffect: (effect: ReturnType<typeof createConnection>) => Promise<unknown>,
) {
  try {
    const [existing] = await db
      .select({ id: connectionTable.id })
      .from(connectionTable)
      .where(and(eq(connectionTable.userId, userId), eq(connectionTable.accountId, accountId)))
      .limit(1);

    if (existing) {
      const encrypted = await encryptCredentials(userId, Buffer.from(accessToken, "utf-8"));
      await db
        .update(connectionTable)
        .set({ credentials: encrypted, updatedAt: new Date() })
        .where(eq(connectionTable.id, existing.id));
      log.debug(
        { userId, providerId, connectionId: existing.id },
        "Updated connection credentials",
      );
    } else {
      const connectionType = typeMap[providerId];
      if (connectionType === undefined) {
        // Provider is a login-only provider (e.g. github, google) — no connection to create
        log.debug({ userId, providerId }, "Skipping connection creation for login-only provider");
        return;
      }
      const label = await resolveLabel(providerId, accountId, accessToken);
      await runEffect(
        createConnection(userId, {
          type: connectionType,
          name: label,
          accountId,
          credentials: Buffer.from(accessToken, "utf-8"),
        }),
      );
      log.debug({ userId, providerId, label }, "Created connection from OAuth");
    }
  } catch (err) {
    log.error({ err, userId, providerId }, "Failed to upsert connection from OAuth");
  }
}
