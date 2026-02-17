/**
 * Filter operators for collection filtering.
 * Values are integers stored in the database.
 */
export const FilterOperator = {
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
} as const;

export type FilterOperator = (typeof FilterOperator)[keyof typeof FilterOperator];

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
  // PropertyType enum values from collections.ts
  const STRING = 2;
  const NUMBER = 8;
  const DATE = 1024;
  const BOOLEAN = 4;
  const REF = 16;
  const REFS = 32;
  const FILE = 64;
  const FILES = 128;

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

  switch (propertyType) {
    case STRING:
      return [...equality, ...stringOps, ...arrayOps, ...common];
    case NUMBER:
      return [...equality, ...comparison, ...arrayOps, ...common];
    case DATE:
      return [...equality, ...comparison, ...common];
    case BOOLEAN:
      return [...equality, ...common];
    case REF:
    case REFS:
      return [...equality, ...arrayOps, ...common];
    case FILE:
    case FILES:
      return common;
    default:
      return [...equality, ...common];
  }
}

/**
 * Evaluate a filter against an item's properties.
 */
export function matchesFilter(props: Record<string, unknown>, filter: Filter): boolean {
  const value = props[filter.property];

  switch (filter.operator) {
    case FilterOperator.IS_NULL:
      return value == null || value === "";
    case FilterOperator.IS_NOT_NULL:
      return value != null && value !== "";
    case FilterOperator.EQ:
      return value === filter.value;
    case FilterOperator.NE:
      return value !== filter.value;
    case FilterOperator.LT:
      return typeof value === "number" && typeof filter.value === "number" && value < filter.value;
    case FilterOperator.LTE:
      return typeof value === "number" && typeof filter.value === "number" && value <= filter.value;
    case FilterOperator.GT:
      return typeof value === "number" && typeof filter.value === "number" && value > filter.value;
    case FilterOperator.GTE:
      return typeof value === "number" && typeof filter.value === "number" && value >= filter.value;
    case FilterOperator.CONTAINS:
      return (
        typeof value === "string" &&
        typeof filter.value === "string" &&
        value.includes(filter.value)
      );
    case FilterOperator.STARTS_WITH:
      return (
        typeof value === "string" &&
        typeof filter.value === "string" &&
        value.startsWith(filter.value)
      );
    case FilterOperator.ENDS_WITH:
      return (
        typeof value === "string" &&
        typeof filter.value === "string" &&
        value.endsWith(filter.value)
      );
    case FilterOperator.IN:
      return Array.isArray(filter.value) && filter.value.includes(value);
    case FilterOperator.NOT_IN:
      return Array.isArray(filter.value) && !filter.value.includes(value);
    default:
      return true;
  }
}

/**
 * Evaluate multiple filters against an item (AND logic).
 */
export function matchesFilters(props: Record<string, unknown>, filters: Filter[]): boolean {
  return filters.every((filter) => matchesFilter(props, filter));
}
