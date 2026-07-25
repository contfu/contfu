import { defineEnum, type EnumValue } from "@contfu/core";
import { PropertyType, propertyTypeBase } from "./schemas";

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

const NULL_CHECK_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.IS_NULL,
  FilterOperator.IS_NOT_NULL,
];
const EQUALITY_OPERATORS: readonly FilterOperator[] = [FilterOperator.EQ, FilterOperator.NE];
const COMPARISON_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.LT,
  FilterOperator.LTE,
  FilterOperator.GT,
  FilterOperator.GTE,
];
const ARRAY_OPERATORS: readonly FilterOperator[] = [FilterOperator.IN, FilterOperator.NOT_IN];
const STRING_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.CONTAINS,
  FilterOperator.STARTS_WITH,
  FilterOperator.ENDS_WITH,
];

const STRING_OPERATOR_TYPES =
  PropertyType.STRING | PropertyType.STRINGS | PropertyType.ENUM | PropertyType.ENUMS;
const COMPARISON_OPERATOR_TYPES = PropertyType.NUMBER | PropertyType.NUMBERS | PropertyType.DATE;
const ARRAY_OPERATOR_TYPES =
  PropertyType.STRINGS |
  PropertyType.NUMBERS |
  PropertyType.ENUMS |
  PropertyType.REF |
  PropertyType.REFS;

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
  // Strip nullable flag to get the base type
  const baseType = propertyTypeBase(propertyType) & ~PropertyType.NULL;

  switch (baseType) {
    case PropertyType.STRING:
    case PropertyType.STRINGS:
    case PropertyType.ENUM:
    case PropertyType.ENUMS:
      return [
        ...EQUALITY_OPERATORS,
        ...STRING_OPERATORS,
        ...ARRAY_OPERATORS,
        ...NULL_CHECK_OPERATORS,
      ];
    case PropertyType.NUMBER:
    case PropertyType.NUMBERS:
      return [
        ...EQUALITY_OPERATORS,
        ...COMPARISON_OPERATORS,
        ...ARRAY_OPERATORS,
        ...NULL_CHECK_OPERATORS,
      ];
    case PropertyType.COLOR:
    case PropertyType.BOOLEAN:
      return [...EQUALITY_OPERATORS, ...NULL_CHECK_OPERATORS];
    case PropertyType.DATE:
      return [...EQUALITY_OPERATORS, ...COMPARISON_OPERATORS, ...NULL_CHECK_OPERATORS];
    case PropertyType.REF:
    case PropertyType.REFS:
      return [...EQUALITY_OPERATORS, ...ARRAY_OPERATORS, ...NULL_CHECK_OPERATORS];
    case PropertyType.FILE:
    case PropertyType.FILES:
    case PropertyType.GEOPOINT:
      return [...NULL_CHECK_OPERATORS];
    default:
      return getOperatorsForTypeMask(baseType);
  }
}

function getOperatorsForTypeMask(baseType: number): FilterOperator[] {
  const result = new Set<FilterOperator>([...EQUALITY_OPERATORS, ...NULL_CHECK_OPERATORS]);

  if (baseType & STRING_OPERATOR_TYPES) {
    for (const operator of STRING_OPERATORS) result.add(operator);
  }

  if (baseType & COMPARISON_OPERATOR_TYPES) {
    for (const operator of COMPARISON_OPERATORS) result.add(operator);
  }

  if (baseType & ARRAY_OPERATOR_TYPES) {
    for (const operator of ARRAY_OPERATORS) result.add(operator);
  }

  if (baseType === PropertyType.FILE || baseType === PropertyType.FILES) {
    return [...NULL_CHECK_OPERATORS];
  }

  if (baseType === PropertyType.COLOR) {
    return [...EQUALITY_OPERATORS, ...NULL_CHECK_OPERATORS];
  }

  return [...result];
}
