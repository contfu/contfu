import { PropertyType } from "./schemas";

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
  /** Allowed enum values for cast === "enum" validation. */
  enumValues?: string[];
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
  // ENUM ↔ STRING casts
  [PropertyType.STRING, PropertyType.ENUM, "enum"],
  [PropertyType.STRINGS, PropertyType.ENUMS, "enum"],
  [PropertyType.ENUM, PropertyType.STRING, "string"],
  [PropertyType.ENUMS, PropertyType.STRINGS, "string"],
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
