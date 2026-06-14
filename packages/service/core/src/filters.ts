import { defineEnum, type EnumValue } from "@contfu/core";
import { PropertyType } from "./schemas";

/**
 * Filter operators for collection filtering.
 * Values are integers stored in the database.
 */
export const FilterOperator = defineEnum({
  // Equality
  EQ: 1,
  NE: 2,
  // Comparison (number, date)
  LT: 3,
  LTE: 4,
  GT: 5,
  GTE: 6,
  // String matching
  CONTAINS: 7,
  STARTS_WITH: 8,
  ENDS_WITH: 9,
  // Array matching
  IN: 10,
  NOT_IN: 11,
  // Null checks
  IS_NULL: 12,
  IS_NOT_NULL: 13,
});

export type FilterOperator = EnumValue<typeof FilterOperator>;

/**
 * A filter condition for collection items.
 */
export interface Filter {
  /** The property name to filter on. */
  property: string;
  /** The filter operator. */
  operator: FilterOperator;
  /** The value to compare against (not needed for isNull/isNotNull). */
  value?: unknown;
}

/**
 * Get valid operators for a given property type.
 */
export function getOperatorsForType(propertyType: number): FilterOperator[] {
  const common: FilterOperator[] = [FilterOperator.IS_NULL, FilterOperator.IS_NOT_NULL];
  const equality: FilterOperator[] = [FilterOperator.EQ, FilterOperator.NE];
  const comparison: FilterOperator[] = [
    FilterOperator.LT,
    FilterOperator.LTE,
    FilterOperator.GT,
    FilterOperator.GTE,
  ];
  const arrayOps: FilterOperator[] = [FilterOperator.IN, FilterOperator.NOT_IN];
  const stringOps: FilterOperator[] = [
    FilterOperator.CONTAINS,
    FilterOperator.STARTS_WITH,
    FilterOperator.ENDS_WITH,
  ];

  // Strip nullable flag to get the base type
  const baseType = propertyType & ~PropertyType.NULL;

  switch (baseType) {
    case PropertyType.STRING:
    case PropertyType.STRINGS:
    case PropertyType.ENUM:
    case PropertyType.ENUMS:
      return [...equality, ...stringOps, ...arrayOps, ...common];
    case PropertyType.NUMBER:
    case PropertyType.NUMBERS:
      return [...equality, ...comparison, ...arrayOps, ...common];
    case PropertyType.COLOR:
      return [...equality, ...common];
    case PropertyType.DATE:
      return [...equality, ...comparison, ...common];
    case PropertyType.BOOLEAN:
      return [...equality, ...common];
    case PropertyType.REF:
    case PropertyType.REFS:
      return [...equality, ...arrayOps, ...common];
    case PropertyType.FILE:
    case PropertyType.FILES:
    case PropertyType.GEOPOINT:
      return common;
    default:
      return getOperatorsForTypeMask(baseType, {
        equality,
        comparison,
        arrayOps,
        stringOps,
        common,
      });
  }
}

function getOperatorsForTypeMask(
  baseType: number,
  operators: {
    equality: FilterOperator[];
    comparison: FilterOperator[];
    arrayOps: FilterOperator[];
    stringOps: FilterOperator[];
    common: FilterOperator[];
  },
): FilterOperator[] {
  const result = new Set([...operators.equality, ...operators.common]);

  if (
    baseType & PropertyType.STRING ||
    baseType & PropertyType.STRINGS ||
    baseType & PropertyType.ENUM ||
    baseType & PropertyType.ENUMS
  ) {
    for (const operator of operators.stringOps) result.add(operator);
  }

  if (
    baseType & PropertyType.NUMBER ||
    baseType & PropertyType.NUMBERS ||
    baseType & PropertyType.DATE
  ) {
    for (const operator of operators.comparison) result.add(operator);
  }

  if (
    baseType & PropertyType.STRINGS ||
    baseType & PropertyType.NUMBERS ||
    baseType & PropertyType.ENUMS ||
    baseType & PropertyType.REF ||
    baseType & PropertyType.REFS
  ) {
    for (const operator of operators.arrayOps) result.add(operator);
  }

  if (baseType === PropertyType.FILE || baseType === PropertyType.FILES) {
    return operators.common;
  }

  if (baseType === PropertyType.COLOR) {
    return [...operators.equality, ...operators.common];
  }

  return [...result];
}
