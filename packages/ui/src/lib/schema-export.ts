import type { CollectionSchema } from "@contfu/core";

export type CollectionSchemaEntry = {
  name: string;
  schema: CollectionSchema | null;
};

type NormalizedSchemaEntry = {
  name: string;
  schema: CollectionSchema;
};

function normalizeEntries(entries: CollectionSchemaEntry[]): NormalizedSchemaEntry[] {
  return entries
    .filter((entry): entry is NormalizedSchemaEntry => entry.schema !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCollectionsSchemaJson(entries: CollectionSchemaEntry[]): string {
  const normalized = normalizeEntries(entries);
  const schemaByCollection = Object.fromEntries(
    normalized.map((entry) => [entry.name, entry.schema] as const),
  );

  return JSON.stringify(schemaByCollection, null, 2);
}
