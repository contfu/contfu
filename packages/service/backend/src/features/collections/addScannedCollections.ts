import { ConnectionType, type CollectionIcon } from "@contfu/core";
import type { AddScannedCollectionsResult, CollectionSchema } from "@contfu/svc-core";
import { Effect } from "effect";
import { QuotaError, ValidationError } from "../../effect/errors";
import { checkQuota } from "../quota/checkQuota";
import { createCollection } from "./createCollection";
import { updateCollection } from "./updateCollection";
import { scanCollections } from "./scanCollections";
import { getConnectionWithCredentials } from "../connections/getConnectionWithCredentials";
import {
  extractNotionIcon,
  isFullDataSource,
  notion,
  notionPropertiesToSchema,
} from "@contfu/svc-sources/notion";

export interface AddScannedCollectionsInput {
  connectionId: number;
  refs?: string[];
  all?: boolean;
  processIcon?: (
    icon: CollectionIcon | null | undefined,
  ) => Promise<CollectionIcon | null | undefined>;
}

type SeedData = {
  schema: CollectionSchema;
  icon: CollectionIcon | null | undefined;
} | null;

function normalizeRefs(refs: string[] | undefined): string[] {
  return Array.from(new Set((refs ?? []).map((ref) => ref.trim()).filter(Boolean)));
}

export const addScannedCollections = (userId: number, input: AddScannedCollectionsInput) =>
  Effect.gen(function* () {
    const refs = normalizeRefs(input.refs);
    if (!input.all && refs.length === 0) {
      yield* Effect.fail(
        new ValidationError({
          field: "refs",
          message: "Provide at least one ref or pass all=true",
        }),
      );
    }

    const scanned = yield* scanCollections(input.connectionId);
    const scannedByRef = new Map(scanned.map((collection) => [collection.ref, collection]));

    if (refs.length > 0) {
      const unknownRefs = refs.filter((ref) => !scannedByRef.has(ref));
      if (unknownRefs.length > 0) {
        yield* Effect.fail(
          new ValidationError({
            field: "refs",
            message: `Unknown refs: ${unknownRefs.join(", ")}`,
          }),
        );
      }

      const alreadyAdded = refs
        .map((ref) => scannedByRef.get(ref)!)
        .filter((collection) => collection.alreadyAdded)
        .map((collection) => collection.ref);
      if (alreadyAdded.length > 0) {
        yield* Effect.fail(
          new ValidationError({
            field: "refs",
            message: `Refs already added: ${alreadyAdded.join(", ")}`,
          }),
        );
      }
    }

    const selected = input.all
      ? scanned.filter((collection) => !collection.alreadyAdded)
      : refs.map((ref) => scannedByRef.get(ref)!);
    const alreadyAdded = input.all ? scanned.filter((collection) => collection.alreadyAdded) : [];

    const quota = yield* Effect.promise(() => checkQuota(userId, "collections"));
    if (quota.max !== -1 && quota.max !== 0 && quota.current + selected.length > quota.max) {
      yield* Effect.fail(
        new QuotaError({
          resource: "collections",
          current: quota.current,
          max: quota.max,
        }),
      );
    }

    const connection = yield* getConnectionWithCredentials(input.connectionId);

    let seedMap = new Map<string, SeedData>();
    if (
      selected.length > 0 &&
      connection?.type === ConnectionType.NOTION &&
      connection.credentials
    ) {
      const auth = connection.credentials.toString("utf-8");
      const fetched = yield* Effect.promise(async () => {
        try {
          return await Promise.allSettled(
            selected.map(async (collection) => {
              const dataSource = await notion.dataSources.retrieve({
                auth,
                data_source_id: collection.ref,
              });
              if (!isFullDataSource(dataSource)) return { ref: collection.ref, seed: null };
              const schema = notionPropertiesToSchema(dataSource.properties);
              const icon = input.processIcon
                ? await input.processIcon(extractNotionIcon(dataSource))
                : extractNotionIcon(dataSource);
              return { ref: collection.ref, seed: { schema, icon } satisfies SeedData };
            }),
          );
        } catch {
          return [] as PromiseSettledResult<{ ref: string; seed: SeedData }>[];
        }
      });

      for (const result of fetched) {
        if (result.status === "fulfilled") {
          seedMap.set(result.value.ref, result.value.seed);
        }
      }
    }

    const added: AddScannedCollectionsResult["added"] = [];
    for (const collection of selected) {
      const seed = seedMap.get(collection.ref);
      const created = yield* createCollection(userId, {
        displayName: collection.displayName,
        connectionId: input.connectionId,
        ref: collection.ref,
        icon: seed?.icon,
      });

      if (seed?.schema) {
        try {
          yield* updateCollection(created.id, { schema: seed.schema });
        } catch {
          // Schema seeding is best-effort; collection is still usable.
        }
      }

      added.push({
        ref: collection.ref,
        id: created.id,
        displayName: created.displayName,
      });
    }

    return {
      added,
      alreadyAdded,
      scanned: scanned.length,
    } satisfies AddScannedCollectionsResult;
  }).pipe(
    Effect.withSpan("collections.addScanned", {
      attributes: { userId, connectionId: input.connectionId },
    }),
  );
