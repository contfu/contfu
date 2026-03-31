import { describe, expect, test } from "bun:test";
import { FilterOperator, getOperatorsForType } from "./filters";
import { PropertyType } from "./schemas";

describe("filters", () => {
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

    test("nullable type strips NULL flag and returns base type operators", () => {
      const ops = getOperatorsForType(PropertyType.STRING | PropertyType.NULL);
      expect(ops).toContain(FilterOperator.CONTAINS);
      expect(ops).toContain(FilterOperator.STARTS_WITH);
      expect(ops).toContain(FilterOperator.IS_NULL);
    });
  });
});
