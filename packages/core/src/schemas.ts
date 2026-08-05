import { defineEnum, type EnumValue } from "./enums";
import type { EffectiveCollectionI18nConfig } from "./i18n";

/**
 * Property types are bit flags. Value types use bits 0–19; bits 24–30 are
 * metadata modifiers which may be combined with a value type.
 */
export const PropertyType = defineEnum({
  // Value types (bits 0–17).
  NULL: 1, // 1 << 0
  BLOCK: 2, // 1 << 1
  STRING: 4, // 1 << 2
  STRINGS: 8, // 1 << 3
  NUMBER: 16, // 1 << 4
  NUMBERS: 32, // 1 << 5
  BOOLEAN: 64, // 1 << 6
  REF: 128, // 1 << 7
  REFS: 256, // 1 << 8
  FILE: 512, // 1 << 9
  FILES: 1024, // 1 << 10
  DATE: 2048, // 1 << 11
  ENUM: 4096, // 1 << 12
  ENUMS: 8192, // 1 << 13
  OBJECT: 16384, // 1 << 14
  GEOPOINT: 32768, // 1 << 15
  COLOR: 65536, // 1 << 16
  PLAINDATE: 131072, // 1 << 17
  // Exact numeric values use canonical decimal strings at JSON/API boundaries.
  BIGINT: 262144, // 1 << 18
  DECIMAL: 524288, // 1 << 19

  // Integration-neutral property metadata (bits 24–30).
  LOCALE: 16777216, // 1 << 24
  IDENTITY: 33554432, // 1 << 25
  UPDATED_AT: 67108864, // 1 << 26
});
export type PropertyType = EnumValue<typeof PropertyType>;

export const PROPERTY_TYPE_MASK = (1 << 20) - 1;
export const PROPERTY_METADATA_MASK = 0x7f000000;

/** Return only value-type bits, excluding integration-neutral metadata. */
export function propertyTypeBase(type: number): number {
  return type & PROPERTY_TYPE_MASK;
}

/** Return only metadata modifier bits. */
export function propertyTypeMetadata(type: number): number {
  return type & PROPERTY_METADATA_MASK;
}

export function hasPropertyType(type: number, flag: number): boolean {
  return (type & flag) !== 0;
}

export type GeoPoint = { lat: number; lon: number };

export type SchemaValue = number | [number, string[]];
export type ComponentSchema = { name: string; props: CollectionSchema | CollectionSchema[] };
export type CollectionSchema = Record<string, SchemaValue>;

/** Extract the numeric type from a schema value (tuple or plain number). */
export function schemaType(v: SchemaValue): number {
  return Array.isArray(v) ? v[0] : v;
}

/** Extract enum values from a schema value, or undefined if not an enum tuple. */
export function schemaEnumValues(v: SchemaValue): string[] | undefined {
  return Array.isArray(v) ? v[1] : undefined;
}

/**
 * Merge two schema values for the same property (e.g. from multiple inflows).
 * Bitwise-ORs the types; unions the enum values if either side has them.
 */
export function mergeSchemaValues(a: SchemaValue, b: SchemaValue): SchemaValue {
  const merged = schemaType(a) | schemaType(b);
  const valsA = schemaEnumValues(a);
  const valsB = schemaEnumValues(b);
  if (valsA || valsB) {
    const combined = [...new Set([...(valsA ?? []), ...(valsB ?? [])])];
    return [merged, combined];
  }
  return merged;
}

export type RefTargets = Record<string, string[]>;

/**
 * Map of `$`-prefixed system schema keys to the emitted property name and TypeScript type.
 * When a collection schema contains one of these keys, the type emitter strips the `$`
 * prefix for the emitted name and uses the mapped TS type. Keys that require an import
 * specify the source module via `importFrom` (prepended once per generated file).
 */
const SYSTEM_SCHEMA_KEYS: Record<string, { name: string; type: string; importFrom?: string }> = {
  $content: { name: "content", type: "Block[]", importFrom: "@contfu/core" },
  $draft: { name: "$draft", type: "boolean" },
  $createdAt: { name: "$createdAt", type: "number" },
  $publishedAt: { name: "$publishedAt", type: "number | null" },
  $locale: { name: "locale", type: "string" },
};

export function isSystemSchemaKey(key: string): boolean {
  return Object.hasOwn(SYSTEM_SCHEMA_KEYS, key);
}

function usesUnconstrainedBlock(collections: TypeGenerationInput[]): boolean {
  for (const col of collections) {
    const sources: CollectionSchema[] =
      col.inflowSchemas && col.inflowSchemas.length > 0 ? col.inflowSchemas : [col.schema];
    for (const source of sources) {
      for (const value of Object.values(source)) {
        if (
          (propertyTypeBase(schemaType(value)) & PropertyType.BLOCK) !== 0 &&
          !schemaEnumValues(value)?.length
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function systemKeyImports(collections: TypeGenerationInput[]): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();
  for (const col of collections) {
    const sources: CollectionSchema[] =
      col.inflowSchemas && col.inflowSchemas.length > 0 ? col.inflowSchemas : [col.schema];
    for (const source of sources) {
      for (const key of Object.keys(source)) {
        const sys = SYSTEM_SCHEMA_KEYS[key];
        if (sys?.importFrom) {
          if (!imports.has(sys.importFrom)) imports.set(sys.importFrom, new Set());
          imports.get(sys.importFrom)!.add(sys.type.replace(/\[\]$/, ""));
        }
      }
    }
  }
  return imports;
}

function collectAllRenderableSchemas(collections: TypeGenerationInput[]): CollectionSchema[] {
  const schemas: CollectionSchema[] = [];
  for (const col of collections) {
    schemas.push(col.schema, ...(col.inflowSchemas ?? []));
    for (const block of col.components ?? []) {
      schemas.push(...(Array.isArray(block.props) ? block.props : [block.props]));
    }
  }
  return schemas;
}

function schemasUsePropertyType(collections: TypeGenerationInput[], propertyType: number): boolean {
  return collectAllRenderableSchemas(collections).some((schema) =>
    Object.values(schema).some((value) => (schemaType(value) & propertyType) !== 0),
  );
}

function renderImportHeader(imports: Map<string, Set<string>>): string[] {
  if (imports.size === 0) return [];
  const lines: string[] = [];
  for (const [module, names] of imports) {
    const sorted = [...names].sort();
    lines.push(`import type { ${sorted.join(", ")} } from "${module}";`);
  }
  lines.push("");
  return lines;
}

function toInterfaceName(name: string): string {
  return name[0].toUpperCase() + name.slice(1);
}

function renderPropertyKey(key: string): string {
  return /^[$A-Z_a-z][$\w]*$/.test(key) ? key : JSON.stringify(key);
}

type RefFormat = "interface" | "lookup";

function formatRefTargets(targets: string[], format: RefFormat): string {
  if (format === "lookup") {
    return targets.map((t) => `ContfuCollections["${t}"]`).join(" | ");
  }
  return targets.map(toInterfaceName).join(" | ");
}

function propertyTypeToTs(
  type: number,
  targets?: string[],
  refFormat: RefFormat = "interface",
  enumValues?: string[],
): string {
  type = propertyTypeBase(type);
  switch (type) {
    case PropertyType.STRING:
      return "string";
    case PropertyType.STRINGS:
      return "string[]";
    case PropertyType.NUMBER:
      return "number";
    case PropertyType.NUMBERS:
      return "number[]";
    // Exact numeric values are serialized as canonical base-10 strings.
    case PropertyType.BIGINT:
    case PropertyType.DECIMAL:
      return "string";
    case PropertyType.COLOR:
      return "Color";
    case PropertyType.BOOLEAN:
      return "boolean";
    case PropertyType.REF:
      if (targets && targets.length > 0) {
        return formatRefTargets(targets, refFormat);
      }
      return "string";
    case PropertyType.REFS:
      if (targets && targets.length > 0) {
        const union = formatRefTargets(targets, refFormat);
        return targets.length > 1 ? `(${union})[]` : `${union}[]`;
      }
      return "string[]";
    case PropertyType.FILE:
      return "FileMetadata";
    case PropertyType.FILES:
      return "FileMetadata[]";
    case PropertyType.DATE:
      return "number";
    case PropertyType.PLAINDATE:
      return "string";
    case PropertyType.BLOCK:
      if (enumValues && enumValues.length > 0) {
        return `(${enumValues.map(toComponentTypeName).join(" | ")})[]`;
      }
      return "Block[]";
    case PropertyType.ENUM:
      if (enumValues && enumValues.length > 0) {
        return enumValues.map((v) => JSON.stringify(v)).join(" | ");
      }
      return "string";
    case PropertyType.ENUMS:
      if (enumValues && enumValues.length > 0) {
        const union = enumValues.map((v) => JSON.stringify(v)).join(" | ");
        return enumValues.length > 1 ? `(${union})[]` : `${union}[]`;
      }
      return "string[]";
    case PropertyType.GEOPOINT:
      return "GeoPoint";
    case PropertyType.OBJECT:
      return "any";
    default:
      return propertyTypeMaskToTs(type, targets, refFormat, enumValues);
  }
}

function propertyTypeMaskToTs(
  type: number,
  targets?: string[],
  refFormat: RefFormat = "interface",
  enumValues?: string[],
): string {
  const members: string[] = [];
  const add = (member: string) => {
    if (!members.includes(member)) members.push(member);
  };

  for (const propertyType of Object.values(PropertyType)) {
    if (
      (propertyType & PROPERTY_METADATA_MASK) !== 0 ||
      propertyType === PropertyType.NULL ||
      (type & propertyType) === 0
    )
      continue;
    const rendered = propertyTypeToTs(propertyType, targets, refFormat, enumValues);
    if (rendered === "unknown") continue;
    add(rendered);
  }

  return members.length > 0 ? members.join(" | ") : "unknown";
}

export interface TypeGenerationInput {
  name: string;
  displayName: string;
  schema: CollectionSchema;
  refTargets?: RefTargets;
  inflowSchemas?: CollectionSchema[];
  components?: ComponentSchema[];
  i18n?: EffectiveCollectionI18nConfig;
}

function toComponentTypeName(componentUid: string): string {
  const base = componentUid.replace(/[^A-Za-z0-9]+/g, " ").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  return `${parts.map((p) => p[0].toUpperCase() + p.slice(1)).join("")}Component`;
}

function collectComponents(collections: TypeGenerationInput[]): ComponentSchema[] {
  const blocks = new Map<string, ComponentSchema>();
  for (const col of collections) {
    for (const block of col.components ?? []) {
      const existing = blocks.get(block.name);
      if (!existing) blocks.set(block.name, block);
      else {
        const props = Array.isArray(existing.props) ? existing.props : [existing.props];
        const next = Array.isArray(block.props) ? block.props : [block.props];
        existing.props = deduplicateSchemas([...props, ...next]);
      }
    }
    const sources: CollectionSchema[] =
      col.inflowSchemas && col.inflowSchemas.length > 0 ? col.inflowSchemas : [col.schema];
    for (const source of sources) {
      for (const value of Object.values(source)) {
        if ((propertyTypeBase(schemaType(value)) & PropertyType.BLOCK) === 0) continue;
        for (const name of schemaEnumValues(value) ?? []) {
          if (!blocks.has(name)) blocks.set(name, { name, props: {} });
        }
      }
    }
  }
  return [...blocks.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Render one union member as a block of lines with the given base indent.
 * baseIndent is the indent for the leading `|` character.
 * Properties are indented 4 spaces further; closing `}` 2 spaces further.
 */
function shouldRenderSchemaKey(key: string, i18n?: TypeGenerationInput["i18n"]): boolean {
  return !(key === "$locale" && i18n?.localized);
}

function renderUnionMember(
  schema: CollectionSchema,
  refTargets: RefTargets | undefined,
  refFormat: RefFormat,
  baseIndent: string,
  isLast: boolean,
  i18n?: TypeGenerationInput["i18n"],
): string[] {
  const lines: string[] = [`${baseIndent}| {`];
  for (const [key, value] of Object.entries(schema)) {
    if (!shouldRenderSchemaKey(key, i18n)) continue;
    const sys = SYSTEM_SCHEMA_KEYS[key];
    const renderedKey = sys ? sys.name : key;
    const renderedType = sys
      ? sys.type
      : propertyTypeToTs(schemaType(value), refTargets?.[key], refFormat, schemaEnumValues(value));
    lines.push(`${baseIndent}    ${renderPropertyKey(renderedKey)}: ${renderedType};`);
  }
  if (i18n?.localized) {
    lines.push(`${baseIndent}    $locale: Locale;`);
  }
  lines.push(`${baseIndent}  }${isLast ? ";" : ""}`);
  return lines;
}

function collectLocales(collections: TypeGenerationInput[]): string[] {
  const locales = new Set<string>();
  for (const collection of collections) {
    for (const locale of collection.i18n?.locales ?? []) {
      locales.add(locale);
    }
  }
  return [...locales].sort();
}

function renderInlineProps(schema: CollectionSchema, refFormat: RefFormat): string {
  const entries = Object.entries(schema);
  if (entries.length === 0) return "Record<string, any>";
  return `{ ${entries.map(([key, value]) => `${renderPropertyKey(key)}: ${propertyTypeToTs(schemaType(value), undefined, refFormat, schemaEnumValues(value))}`).join("; ")} }`;
}

function renderBlockPropsType(
  props: CollectionSchema | CollectionSchema[],
  refFormat: RefFormat,
): string {
  const schemas = deduplicateSchemas(Array.isArray(props) ? props : [props]);
  if (schemas.length === 0) return "Record<string, any>";
  return schemas.map((schema) => renderInlineProps(schema, refFormat)).join(" | ");
}

function addImport(imports: Map<string, Set<string>>, from: string, name: string): void {
  if (!imports.has(from)) imports.set(from, new Set());
  imports.get(from)!.add(name);
}

function deduplicateSchemas(schemas: CollectionSchema[]): CollectionSchema[] {
  const seen = new Set<string>();
  return schemas.filter((schema) => {
    const key = JSON.stringify(Object.entries(schema).sort(([a], [b]) => a.localeCompare(b)));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function appendTypeGenerationPreamble(lines: string[], collections: TypeGenerationInput[]): void {
  const components = collectComponents(collections);
  const imports = systemKeyImports(collections);
  if (usesUnconstrainedBlock(collections)) addImport(imports, "@contfu/core", "Block");
  if (components.length > 0) addImport(imports, "@contfu/core", "Block");
  if (schemasUsePropertyType(collections, PropertyType.GEOPOINT)) {
    addImport(imports, "@contfu/core", "GeoPoint");
  }
  if (schemasUsePropertyType(collections, PropertyType.COLOR)) {
    addImport(imports, "@contfu/core", "Color");
  }
  if (
    schemasUsePropertyType(collections, PropertyType.FILE) ||
    schemasUsePropertyType(collections, PropertyType.FILES)
  ) {
    addImport(imports, "@contfu/core", "FileMetadata");
  }
  lines.push(...renderImportHeader(imports));

  for (const block of components) {
    const typeName = toComponentTypeName(block.name);
    lines.push(
      `export type ${typeName} = ["x", ${JSON.stringify(block.name)}, ${renderBlockPropsType(block.props, "interface")}, Block[]];`,
    );
  }
  if (components.length > 0) lines.push("");

  const locales = collectLocales(collections);
  if (locales.length > 0) {
    lines.push(
      `export type Locale = ${locales.map((locale) => JSON.stringify(locale)).join(" | ")};`,
    );
    lines.push("");
  }
}

export function generateTypeScript(collections: TypeGenerationInput[]): string {
  const lines: string[] = ["// Auto-generated by Contfu — do not edit", ""];
  appendTypeGenerationPreamble(lines, collections);

  for (const col of collections) {
    const interfaceName = toInterfaceName(col.name);
    lines.push(`/** ${col.displayName} */`);

    const unique = col.inflowSchemas ? deduplicateSchemas(col.inflowSchemas) : [];
    if (unique.length >= 2) {
      lines.push(`export type ${interfaceName} =`);
      for (let i = 0; i < unique.length; i++) {
        lines.push(
          ...renderUnionMember(
            unique[i],
            col.refTargets,
            "interface",
            "  ",
            i === unique.length - 1,
            col.i18n,
          ),
        );
      }
    } else {
      lines.push(`export interface ${interfaceName} {`);
      for (const [key, value] of Object.entries(col.schema)) {
        if (!shouldRenderSchemaKey(key, col.i18n)) continue;
        const sys = SYSTEM_SCHEMA_KEYS[key];
        const renderedKey = sys ? sys.name : key;
        const renderedType = sys
          ? sys.type
          : propertyTypeToTs(
              schemaType(value),
              col.refTargets?.[key],
              "interface",
              schemaEnumValues(value),
            );
        lines.push(`  ${renderPropertyKey(renderedKey)}: ${renderedType};`);
      }
      if (col.i18n?.localized) {
        lines.push(`  $locale: Locale;`);
      }
      lines.push("}");
    }

    lines.push("");
  }

  return lines.join("\n");
}

export function generateApplicationIntegrationTypes(collections: TypeGenerationInput[]): string {
  const lines: string[] = ["// Auto-generated by Contfu — do not edit", ""];
  appendTypeGenerationPreamble(lines, collections);

  lines.push("export type ContfuCollections = {");

  for (const col of collections) {
    lines.push(`  /** ${col.displayName} */`);

    const unique = col.inflowSchemas ? deduplicateSchemas(col.inflowSchemas) : [];
    if (unique.length >= 2) {
      lines.push(`  ${col.name}:`);
      for (let i = 0; i < unique.length; i++) {
        lines.push(
          ...renderUnionMember(
            unique[i],
            col.refTargets,
            "lookup",
            "    ",
            i === unique.length - 1,
            col.i18n,
          ),
        );
      }
    } else {
      lines.push(`  ${col.name}: {`);
      for (const [key, value] of Object.entries(col.schema)) {
        if (!shouldRenderSchemaKey(key, col.i18n)) continue;
        const sys = SYSTEM_SCHEMA_KEYS[key];
        const renderedKey = sys ? sys.name : key;
        const renderedType = sys
          ? sys.type
          : propertyTypeToTs(
              schemaType(value),
              col.refTargets?.[key],
              "lookup",
              schemaEnumValues(value),
            );
        lines.push(`    ${renderPropertyKey(renderedKey)}: ${renderedType};`);
      }
      if (col.i18n?.localized) {
        lines.push(`    $locale: Locale;`);
      }
      lines.push(`  };`);
    }
  }

  lines.push("};");
  lines.push("");

  return lines.join("\n");
}

/**
 * @deprecated Use generateApplicationIntegrationTypes. Kept for public API compatibility.
 */
export const generateConsumerTypes = generateApplicationIntegrationTypes;
