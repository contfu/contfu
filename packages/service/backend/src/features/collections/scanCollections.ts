import { ConnectionType, type CollectionIcon } from "@contfu/core";
import type { ScannedCollection } from "@contfu/svc-core";
import { Effect } from "effect";
import { ValidationError, NotFoundError, SourceFetchError } from "../../effect/errors";
import { getConnectionWithCredentials } from "../connections/getConnectionWithCredentials";
import { listCollectionsByConnection } from "./listCollectionsByConnection";
import { extractNotionIcon, iterateDataSources } from "@contfu/svc-sources/notion";
import { iterateContentTypes } from "@contfu/svc-sources/strapi";

function getScanValidationError() {
  return new ValidationError({
    field: "connectionId",
    message: "Connection type does not support scanning collections",
  });
}

export const scanCollections = (connectionId: number) =>
  Effect.gen(function* () {
    const connection = yield* getConnectionWithCredentials(connectionId);
    if (!connection) {
      return yield* Effect.fail(new NotFoundError({ entity: "Connection", id: connectionId }));
    }

    if (connection.type !== ConnectionType.NOTION && connection.type !== ConnectionType.STRAPI) {
      return yield* Effect.fail(getScanValidationError());
    }

    const credentials = connection.credentials?.toString("utf-8") ?? "";
    if (!credentials) return [] satisfies ScannedCollection[];

    const existing = yield* listCollectionsByConnection(connectionId);
    const addedRefs = new Set(existing.map((collection) => collection.refString).filter(Boolean));

    const scanned = yield* Effect.tryPromise({
      try: async () => {
        const result: ScannedCollection[] = [];

        if (connection.type === ConnectionType.NOTION) {
          for await (const ds of iterateDataSources(credentials)) {
            const titleParts = (ds as { title?: Array<{ plain_text?: string }> }).title ?? [];
            const displayName =
              titleParts.map((title) => title.plain_text ?? "").join("") || "Untitled";
            result.push({
              ref: ds.id,
              displayName,
              alreadyAdded: addedRefs.has(ds.id),
              icon: extractNotionIcon(ds) as CollectionIcon | undefined,
            });
          }
        } else {
          const url = connection.url ?? "";
          for await (const ct of iterateContentTypes(url, credentials)) {
            result.push({
              ref: ct.uid,
              displayName: ct.info.displayName,
              alreadyAdded: addedRefs.has(ct.uid),
            });
          }
        }

        return result;
      },
      catch: (cause) => new SourceFetchError({ cause, sourceType: connection.type }),
    });

    return scanned;
  }).pipe(Effect.withSpan("collections.scan", { attributes: { connectionId } }));
