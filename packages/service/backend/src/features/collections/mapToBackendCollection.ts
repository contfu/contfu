import type { Collection } from "../../infra/db/schema";
import type { BackendCollection } from "../../domain/types";
import type { CollectionSchema, RefTargets } from "@contfu/svc-core";
import type { CollectionIcon } from "@contfu/core";
import { unpack } from "msgpackr";

export function mapToBackendCollection(
  row: Collection,
  flowSourceCount: number,
  flowTargetCount: number,
  connectionType: number | null = null,
  connectionName: string | null = null,
): BackendCollection {
  return {
    id: row.id,
    userId: row.userId,
    connectionId: row.connectionId,
    connectionName,
    connectionType,
    name: row.name,
    displayName: row.displayName,
    schema: row.schema ? (unpack(row.schema) as CollectionSchema) : {},
    refTargets: row.refTargets ? (unpack(row.refTargets) as RefTargets) : undefined,
    icon: row.icon ? (unpack(row.icon) as CollectionIcon) : null,
    hasRef: row.ref !== null,
    refString: row.ref ? row.ref.toString("utf-8") : null,
    flowSourceCount,
    flowTargetCount,
    includeRef: row.includeRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
