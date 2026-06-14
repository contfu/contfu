import type { CollectionSchema, SchemaValue } from "@contfu/core";
import { PropertyType, schemaType, schemaEnumValues } from "@contfu/core";

const TYPE_MAP: Record<number, string> = {
  [PropertyType.STRING]: "string",
  [PropertyType.STRINGS]: "string[]",
  [PropertyType.NUMBER]: "number",
  [PropertyType.NUMBERS]: "number[]",
  [PropertyType.COLOR]: "Color",
  [PropertyType.BOOLEAN]: "boolean",
  [PropertyType.REF]: "string",
  [PropertyType.REFS]: "string[]",
  [PropertyType.FILE]: "string",
  [PropertyType.FILES]: "string[]",
  [PropertyType.DATE]: "number",
  [PropertyType.ENUM]: "string",
  [PropertyType.ENUMS]: "string[]",
  [PropertyType.BLOCK]: "Block[]",
  [PropertyType.JSON]: "any",
  [PropertyType.GEOPOINT]: "GeoPoint",
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
  if (TYPE_MAP[numType]) return TYPE_MAP[numType];

  const members: string[] = [];
  for (const propertyType of Object.values(PropertyType)) {
    if (propertyType === PropertyType.NULL || (numType & propertyType) === 0) continue;
    const rendered = TYPE_MAP[propertyType];
    if (rendered && !members.includes(rendered)) members.push(rendered);
  }
  return members.length > 0 ? members.join(" | ") : "unknown";
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

  const hasBlock = entries.some(([, schema]) =>
    Object.values(schema).some((value) => schemaType(value) === PropertyType.BLOCK),
  );
  const hasGeoPoint = entries.some(([, schema]) =>
    Object.values(schema).some((value) => (schemaType(value) & PropertyType.GEOPOINT) !== 0),
  );
  const hasColor = entries.some(([, schema]) =>
    Object.values(schema).some((value) => (schemaType(value) & PropertyType.COLOR) !== 0),
  );
  const typeImports = [
    hasBlock ? "Block" : null,
    hasColor ? "Color" : null,
    hasGeoPoint ? "GeoPoint" : null,
  ].filter((name): name is string => name !== null);
  const importHeader =
    typeImports.length > 0
      ? `import type { ${typeImports.join(", ")} } from "@contfu/core";\n\n`
      : "";
  const baseTypes = `${importHeader}${interfaces.join("\n\n")}`;

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
