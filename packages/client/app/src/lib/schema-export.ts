import { PropertyType, type CollectionSchema } from "@contfu/core";

export type CollectionSchemaEntry = {
  name: string;
  schema: CollectionSchema | null;
};

type NormalizedSchemaEntry = {
  name: string;
  schema: CollectionSchema;
};

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function quoteKey(value: string): string {
  return isIdentifier(value) ? value : JSON.stringify(value);
}

function toPascalCase(value: string): string {
  const cleaned = value
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const base = cleaned.length > 0 ? cleaned : "Collection";
  return /^[0-9]/.test(base) ? `Collection${base}` : base;
}

function uniqueTypeNames(names: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();

  for (const name of names) {
    const base = `${toPascalCase(name)}Props`;
    let candidate = base;
    let index = 2;
    while (used.has(candidate)) {
      candidate = `${base}${index}`;
      index += 1;
    }
    used.add(candidate);
    result.set(name, candidate);
  }

  return result;
}

function toTsType(propType: number): string {
  switch (propType) {
    case PropertyType.NULL:
      return "null";
    case PropertyType.STRING:
      return "string";
    case PropertyType.STRINGS:
      return "string[]";
    case PropertyType.NUMBER:
      return "number";
    case PropertyType.NUMBERS:
      return "number[]";
    case PropertyType.BOOLEAN:
      return "boolean";
    case PropertyType.REF:
      return "string";
    case PropertyType.REFS:
      return "string[]";
    case PropertyType.FILE:
      return "string";
    case PropertyType.FILES:
      return "string[]";
    case PropertyType.DATE:
      return "string | number | Date";
    default:
      return "unknown";
  }
}

function normalizeEntries(entries: CollectionSchemaEntry[]): NormalizedSchemaEntry[] {
  return entries
    .filter((entry): entry is NormalizedSchemaEntry => entry.schema !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCollectionsTypings(entries: CollectionSchemaEntry[]): string {
  const normalized = normalizeEntries(entries);

  if (normalized.length === 0) {
    return [
      "export type Collections = Record<string, Record<string, unknown>>;",
      "export type CollectionName = keyof Collections;",
      "export type CollectionProps<T extends CollectionName> = Collections[T];",
    ].join("\n");
  }

  const typeNames = uniqueTypeNames(normalized.map((entry) => entry.name));
  const chunks: string[] = [];

  for (const entry of normalized) {
    const typeName = typeNames.get(entry.name)!;
    const propLines = Object.entries(entry.schema)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([propName, propType]) => `  ${quoteKey(propName)}?: ${toTsType(propType)} | null;`);

    chunks.push(
      `export type ${typeName} = {\n${propLines.join("\n")}${propLines.length ? "\n" : ""}};`,
    );
  }

  const collectionMapLines = normalized.map(
    (entry) => `  ${JSON.stringify(entry.name)}: ${typeNames.get(entry.name)!};`,
  );
  chunks.push(`export type Collections = {\n${collectionMapLines.join("\n")}\n};`);
  chunks.push("export type CollectionName = keyof Collections;");
  chunks.push("export type CollectionProps<T extends CollectionName> = Collections[T];");

  const unionLines = normalized.map(
    (entry) =>
      `  | { collection: ${JSON.stringify(entry.name)}; props: ${typeNames.get(entry.name)!} }`,
  );
  chunks.push(`export type CollectionItem =\n${unionLines.join("\n")};`);

  return chunks.join("\n\n");
}

export function buildCollectionsSchemaJson(entries: CollectionSchemaEntry[]): string {
  const normalized = normalizeEntries(entries);
  const schemaByCollection = Object.fromEntries(
    normalized.map((entry) => [entry.name, entry.schema] as const),
  );

  return JSON.stringify(schemaByCollection, null, 2);
}
