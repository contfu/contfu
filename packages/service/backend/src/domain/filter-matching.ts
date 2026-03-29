import { type CollectionSchema, schemaType } from "@contfu/svc-core";
import { FilterOperator, getOperatorsForType, type Filter } from "@contfu/svc-core";

/**
 * Find filters that are invalid against a given schema.
 * A filter is invalid if:
 * - Its property does not exist in the schema
 * - Its operator is not valid for the property's type in the new schema
 */
export function findInvalidFilters(filters: Filter[], schema: CollectionSchema): Filter[] {
  return filters.filter((filter) => {
    const propertyValue = schema[filter.property];
    if (propertyValue === undefined) return true;

    const validOperators = getOperatorsForType(schemaType(propertyValue));
    return !validOperators.includes(filter.operator);
  });
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
