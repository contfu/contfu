import { describe, expect, test } from "bun:test";
import { FilterOperator, type Filter } from "@contfu/svc-core";
import { PropertyType } from "@contfu/core";
import { matchesFilter, matchesFilters, findInvalidFilters } from "./filter-matching";

describe("matchesFilter", () => {
  test("eq operator", () => {
    const filter: Filter = {
      property: "status",
      operator: FilterOperator.EQ,
      value: "published",
    };
    expect(matchesFilter({ status: "published" }, filter)).toBe(true);
    expect(matchesFilter({ status: "draft" }, filter)).toBe(false);
  });

  test("ne operator", () => {
    const filter: Filter = { property: "status", operator: FilterOperator.NE, value: "draft" };
    expect(matchesFilter({ status: "published" }, filter)).toBe(true);
    expect(matchesFilter({ status: "draft" }, filter)).toBe(false);
  });

  test("lt operator", () => {
    const filter: Filter = { property: "price", operator: FilterOperator.LT, value: 100 };
    expect(matchesFilter({ price: 50 }, filter)).toBe(true);
    expect(matchesFilter({ price: 100 }, filter)).toBe(false);
    expect(matchesFilter({ price: 150 }, filter)).toBe(false);
  });

  test("lte operator", () => {
    const filter: Filter = { property: "price", operator: FilterOperator.LTE, value: 100 };
    expect(matchesFilter({ price: 50 }, filter)).toBe(true);
    expect(matchesFilter({ price: 100 }, filter)).toBe(true);
    expect(matchesFilter({ price: 150 }, filter)).toBe(false);
  });

  test("gt operator", () => {
    const filter: Filter = { property: "price", operator: FilterOperator.GT, value: 100 };
    expect(matchesFilter({ price: 150 }, filter)).toBe(true);
    expect(matchesFilter({ price: 100 }, filter)).toBe(false);
    expect(matchesFilter({ price: 50 }, filter)).toBe(false);
  });

  test("gte operator", () => {
    const filter: Filter = { property: "price", operator: FilterOperator.GTE, value: 100 };
    expect(matchesFilter({ price: 150 }, filter)).toBe(true);
    expect(matchesFilter({ price: 100 }, filter)).toBe(true);
    expect(matchesFilter({ price: 50 }, filter)).toBe(false);
  });

  test("contains operator", () => {
    const filter: Filter = {
      property: "title",
      operator: FilterOperator.CONTAINS,
      value: "hello",
    };
    expect(matchesFilter({ title: "hello world" }, filter)).toBe(true);
    expect(matchesFilter({ title: "say hello there" }, filter)).toBe(true);
    expect(matchesFilter({ title: "goodbye" }, filter)).toBe(false);
  });

  test("startsWith operator", () => {
    const filter: Filter = {
      property: "title",
      operator: FilterOperator.STARTS_WITH,
      value: "hello",
    };
    expect(matchesFilter({ title: "hello world" }, filter)).toBe(true);
    expect(matchesFilter({ title: "say hello" }, filter)).toBe(false);
  });

  test("endsWith operator", () => {
    const filter: Filter = {
      property: "title",
      operator: FilterOperator.ENDS_WITH,
      value: "world",
    };
    expect(matchesFilter({ title: "hello world" }, filter)).toBe(true);
    expect(matchesFilter({ title: "world hello" }, filter)).toBe(false);
  });

  test("in operator", () => {
    const filter: Filter = {
      property: "status",
      operator: FilterOperator.IN,
      value: ["published", "archived"],
    };
    expect(matchesFilter({ status: "published" }, filter)).toBe(true);
    expect(matchesFilter({ status: "archived" }, filter)).toBe(true);
    expect(matchesFilter({ status: "draft" }, filter)).toBe(false);
  });

  test("notIn operator", () => {
    const filter: Filter = {
      property: "status",
      operator: FilterOperator.NOT_IN,
      value: ["draft", "pending"],
    };
    expect(matchesFilter({ status: "published" }, filter)).toBe(true);
    expect(matchesFilter({ status: "draft" }, filter)).toBe(false);
    expect(matchesFilter({ status: "pending" }, filter)).toBe(false);
  });

  test("isNull operator", () => {
    const filter: Filter = { property: "description", operator: FilterOperator.IS_NULL };
    expect(matchesFilter({ description: null }, filter)).toBe(true);
    expect(matchesFilter({ description: undefined }, filter)).toBe(true);
    expect(matchesFilter({ description: "" }, filter)).toBe(true);
    expect(matchesFilter({}, filter)).toBe(true);
    expect(matchesFilter({ description: "has value" }, filter)).toBe(false);
  });

  test("isNotNull operator", () => {
    const filter: Filter = { property: "description", operator: FilterOperator.IS_NOT_NULL };
    expect(matchesFilter({ description: "has value" }, filter)).toBe(true);
    expect(matchesFilter({ description: null }, filter)).toBe(false);
    expect(matchesFilter({ description: undefined }, filter)).toBe(false);
    expect(matchesFilter({ description: "" }, filter)).toBe(false);
  });

  test("handles missing property as undefined", () => {
    const filter: Filter = { property: "missing", operator: FilterOperator.EQ, value: undefined };
    expect(matchesFilter({}, filter)).toBe(true);
  });

  test("handles type mismatches gracefully", () => {
    // String comparison on number returns false
    const filter: Filter = { property: "count", operator: FilterOperator.CONTAINS, value: "5" };
    expect(matchesFilter({ count: 5 }, filter)).toBe(false);

    // Number comparison on string returns false
    const numFilter: Filter = { property: "text", operator: FilterOperator.GT, value: 10 };
    expect(matchesFilter({ text: "hello" }, numFilter)).toBe(false);
  });
});

describe("matchesFilters", () => {
  test("empty filters array matches everything", () => {
    expect(matchesFilters({ any: "value" }, [])).toBe(true);
    expect(matchesFilters({}, [])).toBe(true);
  });

  test("single filter works like matchesFilter", () => {
    const filters: Filter[] = [
      { property: "status", operator: FilterOperator.EQ, value: "published" },
    ];
    expect(matchesFilters({ status: "published" }, filters)).toBe(true);
    expect(matchesFilters({ status: "draft" }, filters)).toBe(false);
  });

  test("multiple filters use AND logic", () => {
    const filters: Filter[] = [
      { property: "status", operator: FilterOperator.EQ, value: "published" },
      { property: "price", operator: FilterOperator.GT, value: 50 },
    ];

    expect(matchesFilters({ status: "published", price: 100 }, filters)).toBe(true);
    expect(matchesFilters({ status: "published", price: 30 }, filters)).toBe(false);
    expect(matchesFilters({ status: "draft", price: 100 }, filters)).toBe(false);
    expect(matchesFilters({ status: "draft", price: 30 }, filters)).toBe(false);
  });

  test("complex filter combination", () => {
    const filters: Filter[] = [
      { property: "type", operator: FilterOperator.IN, value: ["article", "blog"] },
      { property: "title", operator: FilterOperator.IS_NOT_NULL },
      { property: "views", operator: FilterOperator.GTE, value: 100 },
    ];

    expect(matchesFilters({ type: "article", title: "Test", views: 150 }, filters)).toBe(true);
    expect(matchesFilters({ type: "blog", title: "Test", views: 100 }, filters)).toBe(true);
    expect(matchesFilters({ type: "page", title: "Test", views: 150 }, filters)).toBe(false);
    expect(matchesFilters({ type: "article", title: null, views: 150 }, filters)).toBe(false);
    expect(matchesFilters({ type: "article", title: "Test", views: 50 }, filters)).toBe(false);
  });
});

describe("findInvalidFilters", () => {
  test("returns empty array when all filters are valid", () => {
    const schema = { status: PropertyType.STRING, price: PropertyType.NUMBER };
    const filters: Filter[] = [
      { property: "status", operator: FilterOperator.EQ, value: "published" },
      { property: "price", operator: FilterOperator.GT, value: 100 },
    ];
    expect(findInvalidFilters(filters, schema)).toEqual([]);
  });

  test("detects filter on missing property", () => {
    const schema = { title: PropertyType.STRING };
    const filters: Filter[] = [
      { property: "title", operator: FilterOperator.EQ, value: "test" },
      { property: "removed", operator: FilterOperator.EQ, value: "x" },
    ];
    const invalid = findInvalidFilters(filters, schema);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].property).toBe("removed");
  });

  test("detects operator invalid for new type", () => {
    const schema = { field: PropertyType.BOOLEAN };
    const filters: Filter[] = [
      { property: "field", operator: FilterOperator.CONTAINS, value: "abc" },
    ];
    const invalid = findInvalidFilters(filters, schema);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].operator).toBe(FilterOperator.CONTAINS);
  });

  test("returns empty array for empty filters", () => {
    expect(findInvalidFilters([], { a: PropertyType.STRING })).toEqual([]);
  });

  test("handles nullable property types", () => {
    const schema = { name: PropertyType.STRING | PropertyType.NULL };
    const filters: Filter[] = [
      { property: "name", operator: FilterOperator.CONTAINS, value: "test" },
    ];
    expect(findInvalidFilters(filters, schema)).toEqual([]);
  });

  test("multiple invalid filters", () => {
    const schema = { remaining: PropertyType.BOOLEAN };
    const filters: Filter[] = [
      { property: "gone1", operator: FilterOperator.EQ, value: "a" },
      { property: "remaining", operator: FilterOperator.EQ, value: true },
      { property: "gone2", operator: FilterOperator.GT, value: 5 },
    ];
    const invalid = findInvalidFilters(filters, schema);
    expect(invalid).toHaveLength(2);
    expect(invalid.map((f) => f.property)).toEqual(["gone1", "gone2"]);
  });
});
