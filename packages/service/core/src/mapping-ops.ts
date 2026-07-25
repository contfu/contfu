import {
  PropertyType,
  schemaType,
  schemaEnumValues,
  mergeSchemaValues,
  type CollectionSchema,
  type SchemaValue,
  typeCompatibility,
  type MappingRule,
} from "@contfu/svc-core";

// ---------------------------------------------------------------------------
// Synonym groups for auto-wiring
// ---------------------------------------------------------------------------

/**
 * Synonym groups in the CMS domain. All terms within a group are considered
 * interchangeable. Matching is case-insensitive.
 */
const DRAFT_SCHEMA_KEY = "$draft";
const EXPLICIT_REF_KEY = "$ref";

const SYNONYM_GROUPS: string[][] = [
  ["slug", "path", "link", "href", "url"],
  ["name", "title"],
  ["description", "desc", "descr"],
  ["id", "ref", "uid"],
  ["image", "cover", "thumbnail", "photo", "picture"],
  ["body", "content", "text"],
  ["excerpt", "summary", "teaser"],
  ["author", "creator", "writer"],
  ["order", "position", "pos", "sort", "rank"],
];

const SYNONYM_MAP: Map<string, Set<string>> = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    const lower = term.toLowerCase();
    SYNONYM_MAP.set(lower, new Set(group.map((t) => t.toLowerCase()).filter((t) => t !== lower)));
  }
}

function areSynonyms(a: string, b: string): boolean {
  return SYNONYM_MAP.get(a.toLowerCase())?.has(b.toLowerCase()) ?? false;
}

// ---------------------------------------------------------------------------
// Runtime mapping application
// ---------------------------------------------------------------------------

const CAST_FNS: Record<string, (v: unknown) => unknown> = {
  string: (v) => String(v),
  number: (v) => Number(v),
  boolean: (v) => Boolean(v),
  enum: (v) => v, // pass-through — validation happens in validateSourceItem
};

type MappingValue = { found: true; value: unknown } | { found: false };

function isValidArrayIndex(arrayIndex: number | undefined): arrayIndex is number {
  return arrayIndex !== undefined && Number.isInteger(arrayIndex);
}

function selectArrayValue(value: unknown, arrayIndex: number | undefined): MappingValue {
  if (arrayIndex === undefined) return { found: true, value };
  if (!isValidArrayIndex(arrayIndex)) return { found: false };
  if (!Array.isArray(value)) {
    return arrayIndex === 0 || arrayIndex === -1 ? { found: true, value } : { found: false };
  }
  const index = arrayIndex < 0 ? value.length + arrayIndex : arrayIndex;
  if (index < 0 || index >= value.length) return { found: false };
  return { found: true, value: value[index] };
}

function mappingValue(props: Record<string, unknown>, rule: MappingRule): MappingValue {
  if (rule.source in props) {
    const selected = selectArrayValue(props[rule.source], rule.arrayIndex);
    if (selected.found) return selected;
  }
  if ("default" in rule) return { found: true, value: rule.default };
  return { found: false };
}

/**
 * Apply mapping rules to an item's properties.
 * - If mappings is null/empty → pass through unchanged.
 * - Unmapped source props are dropped.
 * - If a source key is missing, `rule.default` is used (if set), else the key is skipped.
 */
export function applyMappings(
  props: Record<string, unknown>,
  mappings: MappingRule[] | null,
): Record<string, unknown> {
  if (!mappings || mappings.length === 0) return props;

  const result: Record<string, unknown> = Object.fromEntries(
    Object.entries(props).filter(([key]) => key.startsWith("$") && key !== EXPLICIT_REF_KEY),
  );
  for (const rule of mappings) {
    const target = rule.target ?? rule.source;
    const sourceValue = mappingValue(props, rule);
    if (!sourceValue.found) continue;

    const cast = rule.cast ? CAST_FNS[rule.cast] : undefined;
    const value = cast ? cast(sourceValue.value) : sourceValue.value;

    result[target] = value;
  }
  return result;
}

export function hasExplicitRefMapping(mappings: MappingRule[] | null): boolean {
  return !!mappings?.some((rule) => rule.source === EXPLICIT_REF_KEY);
}

export function withoutExplicitRefSchema(schema: CollectionSchema): CollectionSchema {
  if (!(EXPLICIT_REF_KEY in schema)) return schema;
  const { [EXPLICIT_REF_KEY]: _ref, ...rest } = schema;
  return rest;
}

export function withExplicitRefMappingInput(
  props: Record<string, unknown>,
  mappings: MappingRule[] | null,
  ref: string | null | undefined,
): Record<string, unknown> {
  if (!ref || !hasExplicitRefMapping(mappings)) return props;
  return { ...props, [EXPLICIT_REF_KEY]: ref };
}

/**
 * Apply a mapping rule's cast to a source schema value.
 * For "enum" cast: converts STRING→ENUM (or STRINGS→ENUMS), preserving nullable flag
 * and carrying enum values from rule.enumValues or the source if already a tuple.
 */
function selectArraySchemaValue(sourceValue: SchemaValue, rule: MappingRule): SchemaValue {
  if (!isValidArrayIndex(rule.arrayIndex)) return sourceValue;

  const srcType = schemaType(sourceValue);
  const enumValues = schemaEnumValues(sourceValue);
  let selectedType = srcType;
  if (srcType & PropertyType.STRINGS)
    selectedType = (selectedType & ~PropertyType.STRINGS) | PropertyType.STRING;
  if (srcType & PropertyType.NUMBERS)
    selectedType = (selectedType & ~PropertyType.NUMBERS) | PropertyType.NUMBER;
  if (srcType & PropertyType.REFS)
    selectedType = (selectedType & ~PropertyType.REFS) | PropertyType.REF;
  if (srcType & PropertyType.FILES)
    selectedType = (selectedType & ~PropertyType.FILES) | PropertyType.FILE;
  if (srcType & PropertyType.ENUMS)
    selectedType = (selectedType & ~PropertyType.ENUMS) | PropertyType.ENUM;
  return enumValues ? [selectedType, enumValues] : selectedType;
}

function castSchemaValue(sourceValue: SchemaValue, rule: MappingRule): SchemaValue {
  const selectedValue = selectArraySchemaValue(sourceValue, rule);
  if (rule.cast !== "enum") return selectedValue;

  const srcType = schemaType(selectedValue);
  const nullable = !!(srcType & PropertyType.NULL);
  const isMulti = !!(srcType & PropertyType.STRINGS) || !!(srcType & PropertyType.ENUMS);
  const baseType = isMulti ? PropertyType.ENUMS : PropertyType.ENUM;
  const enumType = nullable ? baseType | PropertyType.NULL : baseType;

  // Prefer explicit rule.enumValues, then values already in the source tuple
  const enumVals = rule.enumValues ?? schemaEnumValues(selectedValue) ?? [];
  return [enumType, enumVals];
}

/**
 * Derive a schema value from a mapping rule's default.
 * Used when the source property doesn't exist in the schema (constant injection).
 *
 * A constant injection always produces the same literal value for every item in
 * that inflow, so string/enum defaults are represented as a single-value enum
 * (`[ENUM, ["topic"]]` → `"topic"`) rather than the broad `string` type.
 * This enables discriminated union types when multiple inflows inject different
 * constant values for the same property.
 */
function defaultSchemaValue(rule: MappingRule): SchemaValue | undefined {
  if (!("default" in rule) || rule.default == null) return undefined;
  if (rule.cast === "number" || typeof rule.default === "number") return PropertyType.NUMBER;
  if (rule.cast === "boolean" || typeof rule.default === "boolean") return PropertyType.BOOLEAN;
  // String/enum defaults: represent as a single-value enum literal for precise typing
  return [PropertyType.ENUM, [String(rule.default)]];
}

/**
 * Remap a collection schema according to mapping rules.
 * Keys are renamed from source→target; unmapped keys are dropped, except
 * `$`-prefixed system keys (other than `$ref`), which are preserved to match
 * runtime item mapping.
 * If a rule has cast="enum", the schema value is converted from STRING to ENUM.
 * If the source key is absent but the rule has a default, a synthetic schema entry
 * is injected (mirrors the runtime applyMappings default-fallback behaviour).
 */
export function applyMappingsToSchema(
  schema: CollectionSchema,
  mappings: MappingRule[] | null,
): CollectionSchema {
  if (!mappings || mappings.length === 0) return withoutExplicitRefSchema(schema);

  const result = Object.fromEntries(
    Object.entries(schema).filter(([key]) => key.startsWith("$") && key !== EXPLICIT_REF_KEY),
  ) as CollectionSchema;
  for (const rule of mappings) {
    if (rule.source === DRAFT_SCHEMA_KEY) continue;
    const target = rule.target ?? rule.source;
    if (rule.source in schema) {
      const incoming = castSchemaValue(schema[rule.source], rule);
      result[target] = target in result ? mergeSchemaValues(result[target], incoming) : incoming;
    } else if ("default" in rule) {
      const incoming = defaultSchemaValue(rule);
      if (incoming !== undefined) {
        result[target] = target in result ? mergeSchemaValues(result[target], incoming) : incoming;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Source item validation
// ---------------------------------------------------------------------------

export interface SourceItemValidationError {
  /** Target property name. */
  property: string;
  /** Source property name. */
  sourceProperty: string;
  /** The failing cast (e.g. "number"). */
  cast: string;
}

/**
 * Validate a source item against mapping rules before applying them.
 * Returns errors for each rule whose cast would produce an invalid result.
 * Empty array means the item is valid.
 *
 * @param targetSchema Optional target schema used to look up enum values for "enum" cast validation.
 */
export function validateSourceItem(
  props: Record<string, unknown>,
  mappings: MappingRule[] | null,
  targetSchema?: CollectionSchema,
): SourceItemValidationError[] {
  if (!mappings || mappings.length === 0) return [];

  const errors: SourceItemValidationError[] = [];
  for (const rule of mappings) {
    if (!rule.cast || !CAST_FNS[rule.cast]) continue;

    const sourceValue = mappingValue(props, rule);
    if (!sourceValue.found) continue; // no value to validate

    if (rule.cast === "number") {
      const n = Number(sourceValue.value);
      if (Number.isNaN(n)) {
        errors.push({
          property: rule.target ?? rule.source,
          sourceProperty: rule.source,
          cast: rule.cast,
        });
      }
    } else if (rule.cast === "enum" && sourceValue.value != null) {
      // Resolve enum values from explicit rule.enumValues or target schema
      const targetKey = rule.target ?? rule.source;
      const enumValues =
        rule.enumValues ?? (targetSchema ? schemaEnumValues(targetSchema[targetKey]) : undefined);
      if (enumValues && !enumValues.includes(String(sourceValue.value))) {
        errors.push({
          property: targetKey,
          sourceProperty: rule.source,
          cast: rule.cast,
        });
      }
    }
  }
  return errors;
}

/**
 * Auto-wire mappings for a new influx against an existing target schema.
 *
 * For each target property, finds the best matching source property:
 * - Exact name + compatible type → not guessed
 * - Exact name + safe cast needed → guessed
 * - Synonym name + compatible type → guessed
 * - Synonym name + safe cast needed → guessed
 *
 * Returns only the target properties that could be matched.
 */
export function autoWireMappings(
  targetSchema: CollectionSchema,
  sourceSchema: CollectionSchema,
): MappingRule[] {
  const rules: MappingRule[] = [];

  for (const [targetProp, targetValue] of Object.entries(targetSchema)) {
    if (targetProp === DRAFT_SCHEMA_KEY) continue;
    const targetType = schemaType(targetValue);
    let best: MappingRule | null = null;
    let bestScore = -1; // higher = better; 3=exact+direct, 2=exact+cast, 1=synonym+direct, 0=synonym+cast

    for (const [sourceProp, sourceValue] of Object.entries(sourceSchema)) {
      if (sourceProp === DRAFT_SCHEMA_KEY) continue;
      const sourceType = schemaType(sourceValue);
      const nameExact = sourceProp === targetProp;
      const nameSynonym = !nameExact && areSynonyms(sourceProp, targetProp);
      if (!nameExact && !nameSynonym) continue;

      const compat = typeCompatibility(sourceType, targetType);
      if (!compat.compatible) continue;

      const score = nameExact ? (compat.cast ? 2 : 3) : compat.cast ? 0 : 1;
      if (score > bestScore) {
        bestScore = score;
        best = {
          source: sourceProp,
          target: targetProp,
          ...(compat.cast ? { cast: compat.cast } : {}),
          ...(score < 3 ? { guessed: true } : {}),
        };
      }
    }

    if (best) rules.push(best);
  }

  return rules;
}
