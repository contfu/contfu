import type { CollectionSchema } from "@contfu/core";
import { PropertyType } from "@contfu/core";

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
};

function collectionNameToTypeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1) + "Props";
}

export function generateTypes(schemas: Record<string, CollectionSchema>): string {
  const entries = Object.entries(schemas);
  const typeNames = Object.fromEntries(
    entries.map(([name]) => [name, collectionNameToTypeName(name)]),
  );

  const interfaces = entries.map(([name, schema]) => {
    const props = Object.entries(schema)
      .map(([key, type]) => `  ${key}: ${TYPE_MAP[type] ?? "unknown"};`)
      .join("\n");
    return `export type ${typeNames[name]} = {\n${props}\n};`;
  });

  return interfaces.join("\n\n");
}
