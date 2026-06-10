import { describe, expect, test } from "bun:test";
import { isObjectEqual } from "./objects";

describe("isObjectEqual", () => {
  test("compares objects independent of key order", () => {
    expect(isObjectEqual({ b: 2, a: { y: 4, x: 3 } }, { a: { x: 3, y: 4 }, b: 2 })).toBe(true);
  });

  test("compares arrays by order", () => {
    expect(isObjectEqual([1, { a: 2 }], [1, { a: 2 }])).toBe(true);
    expect(isObjectEqual([1, 2], [2, 1])).toBe(false);
  });

  test("supports depth limits", () => {
    expect(isObjectEqual({ a: { b: 1 } }, { a: { b: 1 } }, { depth: 1 })).toBe(false);
    expect(isObjectEqual({ a: { b: 1 } }, { a: { b: 1 } }, { depth: 2 })).toBe(true);
  });
});
