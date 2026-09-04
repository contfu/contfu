import { PropertyType, propertyTypeBase } from "./schemas";

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
  /** Optional integer array item index to select before applying casts. Negative values select from the end. */
  arrayIndex?: number;
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
  [PropertyType.BIGINT, PropertyType.STRING, "string"],
  [PropertyType.DECIMAL, PropertyType.STRING, "string"],
  [PropertyType.REF, PropertyType.STRING, "string"],
  [PropertyType.REFS, PropertyType.STRINGS, "string"],
  [PropertyType.BOOLEAN, PropertyType.STRING, "string"],
  [PropertyType.DATE, PropertyType.STRING, "string"],
  [PropertyType.PLAINDATE, PropertyType.DATE, "plainDateToDate"],
  [PropertyType.DATE, PropertyType.PLAINDATE, "dateToPlainDate"],
  [PropertyType.PLAINDATE, PropertyType.STRING, "plainDateToString"],
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
  sourceType = propertyTypeBase(sourceType) & ~PropertyType.OPTIONAL;
  targetType = propertyTypeBase(targetType) & ~PropertyType.OPTIONAL;
  // Every possible source value already fits the target — no cast needed.
  if ((sourceType & ~targetType) === 0) return null;
  for (const [from, to, cast] of SAFE_CASTS) {
    if (sourceType === from && (targetType & to) !== 0) return cast;
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
  const sourceBase = propertyTypeBase(sourceType);
  const targetBase = propertyTypeBase(targetType);
  if ((sourceBase & PropertyType.OPTIONAL) !== 0 && (targetBase & PropertyType.OPTIONAL) === 0)
    return { compatible: false };
  const sourceValues = sourceBase & ~PropertyType.OPTIONAL;
  const targetValues = targetBase & ~PropertyType.OPTIONAL;
  if ((sourceValues & ~targetValues) === 0) return { compatible: true, cast: null };
  const cast = safeCast(sourceValues, targetValues);
  if (cast) return { compatible: true, cast };
  return { compatible: false };
}
