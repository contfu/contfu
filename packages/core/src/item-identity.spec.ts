import { describe, expect, test } from "bun:test";
import { isItemIdentity, itemIdentityKey, sameItemIdentity } from "./item-identity";

describe("collection-scoped item identity", () => {
  test("requires a collection and a positive safe integer managed ID", () => {
    expect(isItemIdentity(["posts", 1])).toBe(true);
    for (const value of [
      1,
      "1",
      [],
      ["posts"],
      ["", 1],
      ["posts", 0],
      ["posts", -1],
      ["posts", 1.5],
      ["posts", Number.MAX_SAFE_INTEGER + 1],
      ["posts", "1"],
      ["posts", 1, 2],
    ]) {
      expect(isItemIdentity(value)).toBe(false);
    }
  });

  test("compares both dimensions by value, not tuple object identity", () => {
    expect(sameItemIdentity(["posts", 1], ["posts", 1])).toBe(true);
    expect(sameItemIdentity(["posts", 1], ["authors", 1])).toBe(false);
    expect(sameItemIdentity(["posts", 1], ["posts", 2])).toBe(false);
  });

  test("has a canonical round-trippable key even for delimiter-containing names", () => {
    const identities: [string, number][] = [
      ["posts", 1],
      ["authors", 1],
      ["posts:1", 2],
      ['posts,["quoted"]', 1],
    ];
    const keys = identities.map(itemIdentityKey);
    expect(new Set(keys).size).toBe(identities.length);
    expect(keys.map((key) => JSON.parse(key))).toEqual(identities);
    expect(itemIdentityKey(["posts", 1])).toBe(itemIdentityKey(["posts", 1]));
  });

  test("rejects invalid keys rather than collapsing them through JSON serialization", () => {
    expect(() => itemIdentityKey(["posts", NaN])).toThrow(TypeError);
    expect(() => itemIdentityKey(["posts", Infinity])).toThrow(TypeError);
  });
});
