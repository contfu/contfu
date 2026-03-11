import type { BackendConnection } from "../../domain/types";
import type { Connection } from "../../infra/db/schema";

export function mapToBackendConnection(row: Connection): BackendConnection {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    name: row.name,
    accountId: row.accountId,
    url: row.url,
    uid: row.uid,
    hasCredentials: row.credentials !== null,
    hasWebhookSecret: row.webhookSecret !== null,
    includeRef: row.includeRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
