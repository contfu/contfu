import { describe, expect, test } from "bun:test";
import {
  FilterOperator,
  coerceFilterOperand,
  getOperatorsForType,
  normalizeFilters,
} from "./filters";
import { PropertyType } from "./schemas";

describe("filters", () => {
  describe("plain-date operands", () => {
    test("coerces ISO strings and millisecond timestamps to epoch-day units", () => {
      expect(coerceFilterOperand("2026-07-01", PropertyType.PLAINDATE)).toBe(20_635);
      expect(coerceFilterOperand(Date.UTC(2026, 6, 1), PropertyType.PLAINDATE)).toBe(20_635);
      expect(coerceFilterOperand(20_635, PropertyType.PLAINDATE)).toBe(20_635);
    });

    test("normalizes filters using the source schema", () => {
      expect(
        normalizeFilters([{ property: "due", operator: FilterOperator.GTE, value: "2026-07-01" }], {
          due: PropertyType.PLAINDATE,
        }),
      ).toEqual([{ property: "due", operator: FilterOperator.GTE, value: 20_635 }]);
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

    test("plain-date type includes comparison operations", () => {
      const ops = getOperatorsForType(PropertyType.PLAINDATE);
      expect(ops).toContain(FilterOperator.EQ);
      expect(ops).toContain(FilterOperator.LT);
      expect(ops).toContain(FilterOperator.GTE);
    });

    test("date type includes comparison operations", () => {
      const ops = getOperatorsForType(PropertyType.DATE);
      expect(ops).toContain(FilterOperator.EQ);
      expect(ops).toContain(FilterOperator.LT);
      expect(ops).toContain(FilterOperator.GT);
      expect(ops).not.toContain(FilterOperator.CONTAINS);
    });

    test("geopoint type only supports null checks", () => {
      const ops = getOperatorsForType(PropertyType.GEOPOINT);
      expect(ops).toEqual([FilterOperator.IS_NULL, FilterOperator.IS_NOT_NULL]);
    });

    test("color type supports equality and null checks only", () => {
      const ops = getOperatorsForType(PropertyType.COLOR);
      expect(ops).toContain(FilterOperator.EQ);
      expect(ops).toContain(FilterOperator.NE);
      expect(ops).toContain(FilterOperator.IS_NULL);
      expect(ops).toContain(FilterOperator.IS_NOT_NULL);
      expect(ops).not.toContain(FilterOperator.LT);
      expect(ops).not.toContain(FilterOperator.CONTAINS);
    });

    test("optional type strips OPTIONAL and metadata flags and returns base type operators", () => {
      const ops = getOperatorsForType(
        PropertyType.STRING | PropertyType.OPTIONAL | PropertyType.IDENTITY,
      );
      expect(ops).toContain(FilterOperator.CONTAINS);
      expect(ops).toContain(FilterOperator.STARTS_WITH);
      expect(ops).toContain(FilterOperator.IS_NULL);
    });

    test("type bitmasks include operators for each supported member", () => {
      const ops = getOperatorsForType(
        PropertyType.STRING | PropertyType.NUMBER | PropertyType.BOOLEAN | PropertyType.DATE,
      );
      expect(ops).toContain(FilterOperator.EQ);
      expect(ops).toContain(FilterOperator.CONTAINS);
      expect(ops).toContain(FilterOperator.LT);
      expect(ops).toContain(FilterOperator.GT);
      expect(ops).toContain(FilterOperator.IS_NULL);
    });
  });
});
