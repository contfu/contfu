import type { CollectionSchema, SchemaValue } from "@contfu/core";
import { PropertyType, schemaType, schemaEnumValues } from "@contfu/core";

const TYPE_MAP: Record<number, string> = {
  [PropertyType.STRING]: "string",
  [PropertyType.STRINGS]: "string[]",
  [PropertyType.NUMBER]: "number",
  [PropertyType.NUMBERS]: "number[]",
  [PropertyType.BOOLEAN]: "boolean",
  [PropertyType.REF]: "string",
  [PropertyType.REFS]: "string[]",
  [PropertyType.FILE]: "string",
  [PropertyType.FILES]: "string[]",
  [PropertyType.DATE]: "number",
  [PropertyType.ENUM]: "string",
  [PropertyType.ENUMS]: "string[]",
};

function schemaValueToType(value: SchemaValue): string {
  const numType = schemaType(value);
  const enumVals = schemaEnumValues(value);
  if (numType === PropertyType.ENUM) {
    if (enumVals && enumVals.length > 0) {
      return enumVals.map((v) => JSON.stringify(v)).join(" | ");
    }
    return "string";
  }
  if (numType === PropertyType.ENUMS) {
    if (enumVals && enumVals.length > 0) {
      const union = enumVals.map((v) => JSON.stringify(v)).join(" | ");
      return enumVals.length > 1 ? `(${union})[]` : `${union}[]`;
    }
    return "string[]";
  }
  return TYPE_MAP[numType] ?? "unknown";
}

function collectionNameToTypeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1) + "Props";
}

export function generateTypes(
  schemas: Record<string, CollectionSchema>,
  includeCollectionMap = false,
): string {
  const entries = Object.entries(schemas);
  const typeNames = Object.fromEntries(
    entries.map(([name]) => [name, collectionNameToTypeName(name)]),
  );

  const interfaces = entries.map(([name, schema]) => {
    const props = Object.entries(schema)
      .map(([key, value]) => `  ${key}: ${schemaValueToType(value)};`)
      .join("\n");
    return `export type ${typeNames[name]} = {\n${props}\n};`;
  });

  const baseTypes = interfaces.join("\n\n");

  if (!includeCollectionMap) {
    return baseTypes;
  }

  if (entries.length === 0) {
    return "export type CollectionMap = {};";
  }

  const collectionMap = `export type CollectionMap = {\n${entries
    .map(([name]) => `  ${name}: ${collectionNameToTypeName(name)};`)
    .join("\n")}\n};`;

  return `${baseTypes}\n\n${collectionMap}`;
}
