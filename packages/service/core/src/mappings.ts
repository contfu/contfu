import { PropertyType, type CollectionSchema } from "./schemas";

/**
 * A mapping rule defining how a source property maps to a target property.
 */
export interface MappingRule {
  /** Source property name from the influx's source schema. */
  source: string;
  /** Target property name in the collection schema. If omitted, same as source. */
  target?: string;
  /** Default value when source is null/missing. */
  default?: unknown;
  /** Cast type to coerce the value (e.g. "string", "number", "boolean", "date"). */
  cast?: string;
  /**
   * True when this mapping was auto-guessed (synonym match or type cast required).
   * The user should verify guessed mappings before relying on them.
   */
  guessed?: boolean;
}

// ---------------------------------------------------------------------------
// Auto-wire utilities
// ---------------------------------------------------------------------------

/**
 * Synonym groups in the CMS domain. All terms within a group are considered
 * interchangeable. Matching is case-insensitive.
 */
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

/**
 * Safe single-type casts: (source singleton type, target singleton type) → cast string.
 * Only considers non-overlapping pairs where the conversion is lossless or well-defined.
 */
const SAFE_CASTS: [number, number, string][] = [
  [PropertyType.NUMBER, PropertyType.STRING, "string"],
  [PropertyType.NUMBERS, PropertyType.STRINGS, "string"],
  [PropertyType.REF, PropertyType.STRING, "string"],
  [PropertyType.REFS, PropertyType.STRINGS, "string"],
  [PropertyType.BOOLEAN, PropertyType.STRING, "string"],
  [PropertyType.DATE, PropertyType.STRING, "string"],
];

/**
 * Returns the cast string if sourceType can be safely cast to targetType, or null otherwise.
 */
export function safeCast(sourceType: number, targetType: number): string | null {
  // Direct type overlap — no cast needed
  if (sourceType & targetType) return null;
  for (const [from, to, cast] of SAFE_CASTS) {
    if (sourceType & from && targetType & to) return cast;
  }
  return null;
}

/**
 * Check whether sourceType is compatible with targetType (directly or via safe cast).
 */
export function typeCompatibility(
  sourceType: number,
  targetType: number,
): { compatible: true; cast: string | null } | { compatible: false } {
  if (sourceType & targetType) return { compatible: true, cast: null };
  const cast = safeCast(sourceType, targetType);
  if (cast) return { compatible: true, cast };
  return { compatible: false };
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
// ---------------------------------------------------------------------------
// Runtime mapping application
// ---------------------------------------------------------------------------

const CAST_FNS: Record<string, (v: unknown) => unknown> = {
  string: (v) => String(v),
  number: (v) => Number(v),
  boolean: (v) => Boolean(v),
};

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

  const result: Record<string, unknown> = {};
  for (const rule of mappings) {
    const target = rule.target ?? rule.source;
    let value: unknown;

    if (rule.source in props) {
      value = props[rule.source];
    } else if ("default" in rule) {
      value = rule.default;
    } else {
      continue;
    }

    if (rule.cast && CAST_FNS[rule.cast]) {
      value = CAST_FNS[rule.cast](value);
    }

    result[target] = value;
  }
  return result;
}

/**
 * Remap a collection schema according to mapping rules.
 * Keys are renamed from source→target; unmapped keys are dropped.
 */
export function applyMappingsToSchema(
  schema: CollectionSchema,
  mappings: MappingRule[] | null,
): CollectionSchema {
  if (!mappings || mappings.length === 0) return schema;

  const result: CollectionSchema = {};
  for (const rule of mappings) {
    const target = rule.target ?? rule.source;
    if (rule.source in schema) {
      result[target] = schema[rule.source];
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
 */
export function validateSourceItem(
  props: Record<string, unknown>,
  mappings: MappingRule[] | null,
): SourceItemValidationError[] {
  if (!mappings || mappings.length === 0) return [];

  const errors: SourceItemValidationError[] = [];
  for (const rule of mappings) {
    if (!rule.cast || !CAST_FNS[rule.cast]) continue;

    let value: unknown;
    if (rule.source in props) {
      value = props[rule.source];
    } else if ("default" in rule) {
      value = rule.default;
    } else {
      continue; // no value to validate
    }

    if (rule.cast === "number") {
      const n = Number(value);
      if (Number.isNaN(n)) {
        errors.push({
          property: rule.target ?? rule.source,
          sourceProperty: rule.source,
          cast: rule.cast,
        });
      }
    }
  }
  return errors;
}

export function autoWireMappings(
  targetSchema: CollectionSchema,
  sourceSchema: CollectionSchema,
): MappingRule[] {
  const rules: MappingRule[] = [];

  for (const [targetProp, targetType] of Object.entries(targetSchema)) {
    let best: MappingRule | null = null;
    let bestScore = -1; // higher = better; 3=exact+direct, 2=exact+cast, 1=synonym+direct, 0=synonym+cast

    for (const [sourceProp, sourceType] of Object.entries(sourceSchema)) {
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
