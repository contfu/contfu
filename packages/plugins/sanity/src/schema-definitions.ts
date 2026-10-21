import type {
  ResolvedFieldType,
  SanityFieldDefinition,
  SanitySchemaDefinition,
  SchemaDefinitionIndex,
} from "./schema-types";

const BUILT_IN_TYPES = new Set([
  "string",
  "text",
  "slug",
  "url",
  "email",
  "number",
  "color",
  "boolean",
  "datetime",
  "date",
  "geopoint",
  "reference",
  "crossDatasetReference",
  "globalDocumentReference",
  "image",
  "file",
  "block",
  "object",
  "array",
]);

export function isFieldDefinition(value: unknown): value is SanityFieldDefinition {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function indexSchemaDefinitions(
  schemaTypes: SanitySchemaDefinition[],
): SchemaDefinitionIndex {
  const byName = new Map<string, SanitySchemaDefinition>();
  const ambiguous = new Set<string>();
  for (const definition of schemaTypes) {
    if (typeof definition.name !== "string") continue;
    if (byName.has(definition.name)) ambiguous.add(definition.name);
    else byName.set(definition.name, definition);
  }
  return { byName, ambiguous };
}

export function resolveFieldType(
  field: SanityFieldDefinition,
  definitions: SchemaDefinitionIndex,
  visited: ReadonlySet<string> = new Set(),
): ResolvedFieldType {
  if (typeof field.type !== "string") {
    return {
      type: null,
      field: null,
      definitions: [],
      valid: false,
      reason: "The Sanity field has no named type.",
    };
  }
  const type = field.type;
  if (BUILT_IN_TYPES.has(type)) return { type, field, definitions: [], valid: true };

  if (definitions.ambiguous.has(type)) {
    return {
      type: null,
      field: null,
      definitions: [],
      valid: false,
      reason: `The Sanity type name "${type}" has multiple definitions.`,
    };
  }
  const definition = definitions.byName.get(type);
  if (!definition) {
    return {
      type: null,
      field: null,
      definitions: [],
      valid: false,
      reason: `The Sanity type "${type}" is not a built-in type or a named schema definition.`,
    };
  }
  if (visited.has(type)) {
    return {
      type: null,
      field: null,
      definitions: [definition],
      valid: false,
      reason: `The named Sanity type "${type}" contains an unresolved type cycle.`,
    };
  }
  if (definition.type === "document" || typeof definition.type !== "string") {
    return {
      type: null,
      field: null,
      definitions: [definition],
      valid: false,
      reason: `The named Sanity type "${type}" does not resolve to a field type.`,
    };
  }

  const merged = {
    ...definition,
    ...field,
    type: definition.type,
    fields: field.fields ?? definition.fields,
    of: field.of ?? definition.of,
  } as SanityFieldDefinition;
  const nextVisited = new Set(visited);
  nextVisited.add(type);
  const resolved = resolveFieldType(merged, definitions, nextVisited);
  return {
    ...resolved,
    definitions: [definition, ...resolved.definitions],
    valid: resolved.valid,
  };
}
