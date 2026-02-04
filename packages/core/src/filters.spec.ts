import { describe, expect, test } from "bun:test";
import {
  FilterOperator,
  matchesFilter,
  matchesFilters,
  getOperatorsForType,
  type Filter,
} from "./filters";
import { PropertyType } from "./collections";

describe("filters", () => {
  describe("matchesFilter", () => {
    test("eq operator", () => {
      const filter: Filter = { property: "status", operator: FilterOperator.EQ, value: "published" };
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
      const filter: Filter = { property: "title", operator: FilterOperator.CONTAINS, value: "hello" };
      expect(matchesFilter({ title: "hello world" }, filter)).toBe(true);
      expect(matchesFilter({ title: "say hello there" }, filter)).toBe(true);
      expect(matchesFilter({ title: "goodbye" }, filter)).toBe(false);
    });

    test("startsWith operator", () => {
      const filter: Filter = { property: "title", operator: FilterOperator.STARTS_WITH, value: "hello" };
      expect(matchesFilter({ title: "hello world" }, filter)).toBe(true);
      expect(matchesFilter({ title: "say hello" }, filter)).toBe(false);
    });

    test("endsWith operator", () => {
      const filter: Filter = { property: "title", operator: FilterOperator.ENDS_WITH, value: "world" };
      expect(matchesFilter({ title: "hello world" }, filter)).toBe(true);
      expect(matchesFilter({ title: "world hello" }, filter)).toBe(false);
    });

    test("in operator", () => {
      const filter: Filter = { property: "status", operator: FilterOperator.IN, value: ["published", "archived"] };
      expect(matchesFilter({ status: "published" }, filter)).toBe(true);
      expect(matchesFilter({ status: "archived" }, filter)).toBe(true);
      expect(matchesFilter({ status: "draft" }, filter)).toBe(false);
    });

    test("notIn operator", () => {
      const filter: Filter = { property: "status", operator: FilterOperator.NOT_IN, value: ["draft", "pending"] };
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
      
      // Both match
      expect(matchesFilters({ status: "published", price: 100 }, filters)).toBe(true);
      
      // First matches, second doesn't
      expect(matchesFilters({ status: "published", price: 30 }, filters)).toBe(false);
      
      // Second matches, first doesn't
      expect(matchesFilters({ status: "draft", price: 100 }, filters)).toBe(false);
      
      // Neither matches
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

  describe("getOperatorsForType", () => {
    test("string type includes string operations", () => {
      const ops = getOperatorsForType(PropertyType.STRING);
      expect(ops).toContain(FilterOperator.EQ);
      expect(ops).toContain(FilterOperator.CONTAINS);
      expect(ops).toContain(FilterOperator.STARTS_WITH);
      expect(ops).toContain(FilterOperator.ENDS_WITH);
      expect(ops).toContain(FilterOperator.IS_NULL);
    });

    test("number type includes comparison operations", () => {
      const ops = getOperatorsForType(PropertyType.NUMBER);
      expect(ops).toContain(FilterOperator.EQ);
      expect(ops).toContain(FilterOperator.LT);
      expect(ops).toContain(FilterOperator.LTE);
      expect(ops).toContain(FilterOperator.GT);
      expect(ops).toContain(FilterOperator.GTE);
      expect(ops).not.toContain(FilterOperator.CONTAINS);
    });

    test("boolean type has limited operations", () => {
      const ops = getOperatorsForType(PropertyType.BOOLEAN);
      expect(ops).toContain(FilterOperator.EQ);
      expect(ops).toContain(FilterOperator.NE);
      expect(ops).toContain(FilterOperator.IS_NULL);
      expect(ops).not.toContain(FilterOperator.CONTAINS);
      expect(ops).not.toContain(FilterOperator.GT);
    });

    test("date type includes comparison operations", () => {
      const ops = getOperatorsForType(PropertyType.DATE);
      expect(ops).toContain(FilterOperator.EQ);
      expect(ops).toContain(FilterOperator.LT);
      expect(ops).toContain(FilterOperator.GT);
      expect(ops).not.toContain(FilterOperator.CONTAINS);
    });
  });
});
