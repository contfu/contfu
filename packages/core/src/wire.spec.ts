import { describe, expect, test } from "bun:test";
import { diffWireItemPatch, materializeWireItemPatch, type WireItem } from "./wire";

describe("wire item sparse patches", () => {
  test("patches props shallowly and deletes undefined props", () => {
    const previous: WireItem = [1, "posts", 1, { a: 1, b: 2 }];
    const next = materializeWireItemPatch([1, "posts", 2, { a: 3, b: undefined }], previous);

    expect(next[3]).toEqual({ a: 3 });
  });

  test("omitted content is unchanged and empty content removes content", () => {
    const previous: WireItem = [1, "posts", 1, { a: 1 }, [["p", ["x"]]]];

    expect(materializeWireItemPatch([1, "posts", 2, { a: 2 }], previous)[4]).toEqual([
      ["p", ["x"]],
    ]);
    expect(materializeWireItemPatch([1, "posts", 3, undefined, []], previous)[4]).toEqual([]);
  });

  test("diff emits a sparse patch when previous full item is known", () => {
    const previous: WireItem = [1, "posts", 1, { a: 1, b: 2 }, [["p", ["x"]]]];
    const next: WireItem = [1, "posts", 2, { a: 2 }];

    expect(diffWireItemPatch(previous, next)).toEqual([1, "posts", 2, { a: 2, b: undefined }, []]);
  });

  test("diff ignores structurally equal props and content", () => {
    const previous: WireItem = [1, "posts", 1, { data: { b: 2, a: 1 } }, [["p", ["x"]]]];
    const next: WireItem = [1, "posts", 2, { data: { a: 1, b: 2 } }, [["p", ["x"]]]];

    expect(diffWireItemPatch(previous, next)).toEqual([1, "posts", 2]);
  });
});
