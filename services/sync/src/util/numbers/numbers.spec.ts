import { describe, expect, it } from "bun:test";
import { combine2ints } from "./numbers";

describe("combine2ints()", () => {
  it("should compress and expand", () => {
    const [compress, expand] = combine2ints(10, 10);

    const compressed = compress(1, 2);
    const expanded = expand(compressed);

    expect(compressed).toEqual(1 * 2 ** 10 + 2);
    expect(expanded).toEqual([1, 2]);
  });
});
