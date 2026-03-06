import type { BackendIntegration } from "../../domain/types";
import type { Integration } from "../../infra/db/schema";

export function mapToBackendIntegration(row: Integration): BackendIntegration {
  return {
    id: row.id,
    userId: row.userId,
    providerId: row.providerId,
    label: row.label,
    accountId: row.accountId,
    hasCredentials: row.credentials !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
