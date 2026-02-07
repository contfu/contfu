import { describe, expect, it } from "bun:test";
import { validateFiltersAgainstSchema, isSchemaCompatible } from "./validateFilters";
import type { CollectionSchema, Filter } from "@contfu/core";
import { FilterOperator, PropertyType } from "@contfu/core";

describe("validateFiltersAgainstSchema", () => {
  // CollectionSchema is Record<string, number> mapping property name to PropertyType
  const schema: CollectionSchema = {
    title: PropertyType.STRING,
    description: PropertyType.STRING | PropertyType.NULL,
    count: PropertyType.NUMBER,
    published: PropertyType.BOOLEAN,
    createdAt: PropertyType.DATE,
  };

  it("should return valid for empty filters", () => {
    const result = validateFiltersAgainstSchema([], schema);
    expect(result.valid).toBe(true);
    expect(result.invalidFilters).toHaveLength(0);
  });

  it("should validate filter on existing string property", () => {
    const filters: Filter[] = [
      { property: "title", operator: FilterOperator.CONTAINS, value: "test" },
    ];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(true);
  });

  it("should validate filter on existing number property", () => {
    const filters: Filter[] = [{ property: "count", operator: FilterOperator.GT, value: 10 }];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(true);
  });

  it("should validate filter on existing boolean property", () => {
    const filters: Filter[] = [{ property: "published", operator: FilterOperator.EQ, value: true }];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(true);
  });

  it("should invalidate filter on non-existent property", () => {
    const filters: Filter[] = [
      { property: "category", operator: FilterOperator.EQ, value: "news" },
    ];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(false);
    expect(result.invalidFilters).toHaveLength(1);
    expect(result.errors[0]).toContain("does not exist");
  });

  it("should invalidate string operator on number property", () => {
    const filters: Filter[] = [
      { property: "count", operator: FilterOperator.CONTAINS, value: "5" },
    ];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not valid for property");
  });

  it("should invalidate comparison operator on boolean property", () => {
    const filters: Filter[] = [{ property: "published", operator: FilterOperator.GT, value: true }];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(false);
  });

  it("should validate multiple valid filters", () => {
    const filters: Filter[] = [
      { property: "title", operator: FilterOperator.CONTAINS, value: "test" },
      { property: "count", operator: FilterOperator.GTE, value: 5 },
      { property: "published", operator: FilterOperator.EQ, value: true },
    ];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(true);
  });

  it("should return all invalid filters when multiple are invalid", () => {
    const filters: Filter[] = [
      { property: "title", operator: FilterOperator.CONTAINS, value: "test" }, // valid
      { property: "missing1", operator: FilterOperator.EQ, value: "x" }, // invalid
      { property: "missing2", operator: FilterOperator.EQ, value: "y" }, // invalid
    ];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(false);
    expect(result.invalidFilters).toHaveLength(2);
  });

  it("should allow isNull/isNotNull on nullable properties", () => {
    const filters: Filter[] = [{ property: "description", operator: FilterOperator.IS_NULL }];
    const result = validateFiltersAgainstSchema(filters, schema);
    expect(result.valid).toBe(true);
  });
});

describe("isSchemaCompatible", () => {
  const oldSchema: CollectionSchema = {
    title: PropertyType.STRING,
    category: PropertyType.STRING,
    count: PropertyType.NUMBER,
  };

  it("should return valid when no filters exist", () => {
    const newSchema: CollectionSchema = {
      title: PropertyType.STRING,
    };
    const result = isSchemaCompatible([], oldSchema, newSchema);
    expect(result.valid).toBe(true);
  });

  it("should return valid when filtered property still exists", () => {
    const filters: Filter[] = [
      { property: "title", operator: FilterOperator.CONTAINS, value: "test" },
    ];
    const newSchema: CollectionSchema = {
      title: PropertyType.STRING,
      newField: PropertyType.STRING,
    };
    const result = isSchemaCompatible(filters, oldSchema, newSchema);
    expect(result.valid).toBe(true);
  });

  it("should return invalid when filtered property is removed", () => {
    const filters: Filter[] = [
      { property: "category", operator: FilterOperator.EQ, value: "news" },
    ];
    const newSchema: CollectionSchema = {
      title: PropertyType.STRING,
      // category removed!
    };
    const result = isSchemaCompatible(filters, oldSchema, newSchema);
    expect(result.valid).toBe(false);
    expect(result.invalidFilters).toHaveLength(1);
    expect(result.invalidFilters[0].property).toBe("category");
  });

  it("should return invalid when property type changes incompatibly", () => {
    const filters: Filter[] = [{ property: "count", operator: FilterOperator.GT, value: 10 }];
    const newSchema: CollectionSchema = {
      title: PropertyType.STRING,
      count: PropertyType.STRING, // changed from NUMBER to STRING
    };
    const result = isSchemaCompatible(filters, oldSchema, newSchema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not valid for property");
  });
});
