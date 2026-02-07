import type { CollectionSchema, Filter } from "@contfu/core";
import { FilterOperator, PropertyType } from "@contfu/core";

export interface FilterValidationResult {
  valid: boolean;
  invalidFilters: Filter[];
  errors: string[];
}

// Operator sets by type
const commonOps: FilterOperator[] = [FilterOperator.IS_NULL, FilterOperator.IS_NOT_NULL];
const equalityOps: FilterOperator[] = [FilterOperator.EQ, FilterOperator.NE];
const comparisonOps: FilterOperator[] = [
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

const operatorsByType: Record<number, FilterOperator[]> = {
  [PropertyType.STRING]: [...equalityOps, ...stringOps, ...arrayOps, ...commonOps],
  [PropertyType.NUMBER]: [...equalityOps, ...comparisonOps, ...arrayOps, ...commonOps],
  [PropertyType.BOOLEAN]: [...equalityOps, ...commonOps],
  [PropertyType.DATE]: [...equalityOps, ...comparisonOps, ...commonOps],
};

/**
 * Validate that filters are compatible with a schema.
 * Returns which filters are invalid and why.
 *
 * CollectionSchema is Record<string, number> where key is property name
 * and value is the PropertyType bitmask.
 */
export function validateFiltersAgainstSchema(
  filters: Filter[],
  schema: CollectionSchema,
): FilterValidationResult {
  const invalidFilters: Filter[] = [];
  const errors: string[] = [];

  const schemaFields = new Set(Object.keys(schema));

  for (const filter of filters) {
    // Check if the property exists in the schema
    if (!schemaFields.has(filter.property)) {
      invalidFilters.push(filter);
      errors.push(`Property "${filter.property}" does not exist in schema`);
      continue;
    }

    // Get the property type
    const propType = schema[filter.property];

    // Build valid operators based on property type flags
    let validOps: FilterOperator[] = [];
    if (propType & PropertyType.STRING)
      validOps = [...validOps, ...operatorsByType[PropertyType.STRING]];
    if (propType & PropertyType.NUMBER)
      validOps = [...validOps, ...operatorsByType[PropertyType.NUMBER]];
    if (propType & PropertyType.BOOLEAN)
      validOps = [...validOps, ...operatorsByType[PropertyType.BOOLEAN]];
    if (propType & PropertyType.DATE)
      validOps = [...validOps, ...operatorsByType[PropertyType.DATE]];

    // Remove duplicates
    validOps = [...new Set(validOps)];

    // Default to equality + common if no type matched
    if (validOps.length === 0) {
      validOps = [...equalityOps, ...commonOps];
    }

    if (!validOps.includes(filter.operator)) {
      invalidFilters.push(filter);
      errors.push(
        `Operator "${filter.operator}" is not valid for property "${filter.property}" of type ${propType}`,
      );
    }
  }

  return {
    valid: invalidFilters.length === 0,
    invalidFilters,
    errors,
  };
}

/**
 * Check if a new schema is compatible with existing filters.
 * Returns true if all filters would still work with the new schema.
 */
export function isSchemaCompatible(
  filters: Filter[],
  oldSchema: CollectionSchema,
  newSchema: CollectionSchema,
): FilterValidationResult {
  // If no filters, any schema change is compatible
  if (filters.length === 0) {
    return { valid: true, invalidFilters: [], errors: [] };
  }

  // Validate filters against the new schema
  return validateFiltersAgainstSchema(filters, newSchema);
}
