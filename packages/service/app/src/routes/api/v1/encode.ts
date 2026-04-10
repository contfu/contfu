import { encodeId, decodeId, type EntityType } from "@contfu/svc-backend/infra/ids";
import { error } from "@sveltejs/kit";
import type { ApiConnection } from "@contfu/svc-core";
import type {
  BackendConnection,
  BackendFlowWithDetails,
  BackendAddScannedCollectionsResult,
} from "@contfu/svc-backend/domain/types";
import type { AddScannedCollectionsResult } from "@contfu/svc-core";
import { encodeCollection } from "$lib/mappers/collection.mappers";

export { encodeCollection };

/**
 * Decode an encoded ID from a URL path parameter.
 * Throws a 400 error if the ID is invalid.
 */
export function parseIdParam(entity: EntityType, param: string): number {
  const id = decodeId(entity, param);
  if (id === null) error(400, "Invalid ID");
  return id;
}

/**
 * Encode a BackendConnection to an ApiConnection with obfuscated IDs.
 */
export function encodeApiConnection(
  conn: BackendConnection & { collectionCount?: number },
): ApiConnection & { collectionCount?: number } {
  const encoded: ApiConnection & { collectionCount?: number } = {
    id: encodeId("connection", conn.id),
    name: conn.name,
    type: conn.type,
    accountId: conn.accountId,
    url: conn.url,
    hasCredentials: conn.hasCredentials,
    includeRef: conn.includeRef,
    createdAt: conn.createdAt as unknown as string,
    updatedAt: conn.updatedAt as unknown as string | null,
  };
  if (conn.collectionCount !== undefined) {
    encoded.collectionCount = conn.collectionCount;
  }
  return encoded;
}

/**
 * Encode a BackendFlowWithDetails with obfuscated IDs.
 */
export function encodeApiFlow(flow: BackendFlowWithDetails) {
  return {
    ...flow,
    id: encodeId("flow", flow.id),
    sourceId: encodeId("collection", flow.sourceId),
    targetId: encodeId("collection", flow.targetId),
  };
}

/**
 * Encode the result of addScannedCollections with obfuscated collection IDs.
 */
export function encodeAddScannedResult(
  result: BackendAddScannedCollectionsResult,
): AddScannedCollectionsResult {
  return {
    ...result,
    added: result.added.map((a) => ({
      ...a,
      id: encodeId("collection", a.id),
    })),
  };
}
