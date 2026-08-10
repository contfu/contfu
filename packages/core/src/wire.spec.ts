import { describe, expect, test } from "bun:test";
import {
  diffWireItemPatch,
  isWireLeaseRequest,
  materializeWireItemPatch,
  type WireItem,
} from "./wire";
import { ClientEventType, EventType } from "./events";

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

describe("file lease wire messages", () => {
  test("accepts an encoded source selector and plain item selector", () => {
    expect(
      isWireLeaseRequest([ClientEventType.FILE_LEASE_REQUEST, 4, 20, "Qx2abc", "9", "handle"]),
    ).toBe(true);
    expect(
      isWireLeaseRequest([ClientEventType.FILE_LEASE_REQUEST, 4, 20, "Qx2abc", 9, "handle"]),
    ).toBe(true);
  });

  test("rejects encoded item or malformed selectors and responses", () => {
    expect(
      isWireLeaseRequest([ClientEventType.FILE_LEASE_REQUEST, 4, 20, "Qx2abc", "K9defg", "handle"]),
    ).toBe(false);
    expect(isWireLeaseRequest([ClientEventType.FILE_LEASE_REQUEST, 4, 20, "", "9", "handle"])).toBe(
      false,
    );
    expect(isWireLeaseRequest([ClientEventType.FILE_LEASE_REQUEST, 4, 20, "Qx2abc", ""])).toBe(
      false,
    );
    expect(
      isWireLeaseRequest([ClientEventType.FILE_LEASE_REQUEST, 4, 20, "Qx2abc", 0, "handle"]),
    ).toBe(false);
    expect(isWireLeaseRequest([EventType.FILE_LEASE_RESPONSE, 1, 99])).toBe(false);
  });
});
