import type { CollectionSchema, SchemaValue } from "@contfu/core";
import {
  PROPERTY_METADATA_MASK,
  PropertyType,
  propertyTypeBase,
  schemaType,
  schemaEnumValues,
} from "@contfu/core";

const TYPE_MAP: Record<number, string> = {
  [PropertyType.STRING]: "string",
  [PropertyType.STRINGS]: "string[]",
  [PropertyType.NUMBER]: "number",
  [PropertyType.NUMBERS]: "number[]",
  // Exact numeric values cross client/API boundaries as canonical decimal strings.
  [PropertyType.BIGINT]: "string",
  [PropertyType.DECIMAL]: "string",
  [PropertyType.COLOR]: "Color",
  [PropertyType.BOOLEAN]: "boolean",
  [PropertyType.REF]: "string",
  [PropertyType.REFS]: "string[]",
  [PropertyType.FILE]: "FileMetadata",
  [PropertyType.FILES]: "FileMetadata[]",
  [PropertyType.DATE]: "number",
  [PropertyType.PLAINDATE]: "string",
  [PropertyType.ENUM]: "string",
  [PropertyType.ENUMS]: "string[]",
  [PropertyType.BLOCK]: "Block[]",
  [PropertyType.OBJECT]: "any",
  [PropertyType.GEOPOINT]: "GeoPoint",
};

function enumValuesToType(propertyType: number, enumVals: string[]): string {
  const union = enumVals.map((v) => JSON.stringify(v)).join(" | ");
  if (propertyType === PropertyType.ENUM) return union;
  return enumVals.length > 1 ? `(${union})[]` : `${union}[]`;
}

function schemaValueToType(value: SchemaValue): string {
  const numType = propertyTypeBase(schemaType(value));
  const enumVals = schemaEnumValues(value);
  const enumType = numType & (PropertyType.ENUM | PropertyType.ENUMS);
  const nonEnumType = numType & ~(PropertyType.ENUM | PropertyType.ENUMS | PropertyType.OPTIONAL);

  // OPTIONAL is represented by an optional property, not a null union, but enum
  // tuples retain their literal values when they are otherwise standalone.
  if (nonEnumType === 0 && enumType === PropertyType.ENUM) {
    return enumVals && enumVals.length > 0
      ? enumValuesToType(PropertyType.ENUM, enumVals)
      : "string";
  }
  if (nonEnumType === 0 && enumType === PropertyType.ENUMS) {
    return enumVals && enumVals.length > 0
      ? enumValuesToType(PropertyType.ENUMS, enumVals)
      : "string[]";
  }
  if (TYPE_MAP[numType]) return TYPE_MAP[numType];

  const members: string[] = [];
  for (const propertyType of Object.values(PropertyType)) {
    if (
      (propertyType & PROPERTY_METADATA_MASK) !== 0 ||
      propertyType === PropertyType.OPTIONAL ||
      (numType & propertyType) === 0
    )
      continue;
    const rendered =
      (propertyType === PropertyType.ENUM || propertyType === PropertyType.ENUMS) &&
      enumVals &&
      enumVals.length > 0
        ? enumValuesToType(propertyType, enumVals)
        : TYPE_MAP[propertyType];
    if (rendered && !members.includes(rendered)) members.push(rendered);
  }
  return members.length > 0 ? members.join(" | ") : "void";
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
      .map(
        ([key, value]) =>
          `  ${key}${schemaType(value) & PropertyType.OPTIONAL ? "?" : ""}: ${schemaValueToType(value)};`,
      )
      .join("\n");
    return `export type ${typeNames[name]} = {\n${props}\n};`;
  });

  const hasBlock = entries.some(([, schema]) =>
    Object.values(schema).some(
      (value) => (propertyTypeBase(schemaType(value)) & PropertyType.BLOCK) !== 0,
    ),
  );
  const hasGeoPoint = entries.some(([, schema]) =>
    Object.values(schema).some((value) => (schemaType(value) & PropertyType.GEOPOINT) !== 0),
  );
  const hasColor = entries.some(([, schema]) =>
    Object.values(schema).some((value) => (schemaType(value) & PropertyType.COLOR) !== 0),
  );
  const hasFiles = entries.some(([, schema]) =>
    Object.values(schema).some(
      (value) => (schemaType(value) & (PropertyType.FILE | PropertyType.FILES)) !== 0,
    ),
  );
  const typeImports = [
    hasBlock ? "Block" : null,
    hasColor ? "Color" : null,
    hasFiles ? "FileMetadata" : null,
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
