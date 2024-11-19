import { describe, expect, it } from "bun:test";
import { SortedSet } from "./sorted-set";

describe("SortedSet", () => {
  it("should add elements in a sorted manner", () => {
    const set = new SortedSet<number>();

    set.add(3);
    set.add(1);
    set.add(2);

    expect(set.length).toBe(3);
    expect(set).toEqual([1, 2, 3] as any);
  });

  it("should delete elements", () => {
    const set = new SortedSet<number>({ seed: [1, 2, 3] });

    set.delete(2);
    set.delete(3);

    expect(set).toEqual([1] as any);
  });

  it("should sort the seed", () => {
    const set = new SortedSet<number>({ seed: [3, 1, 2] });

    expect(set).toEqual([1, 2, 3] as any);
  });

  it("should sort on push", () => {
    const set = new SortedSet<number>();

    set.push(3, 1, 2);

    expect(set).toEqual([1, 2, 3] as any);
  });

  it("should sort on concat", () => {
    const set = new SortedSet<number>({ seed: [3, 1, 2] });

    const s = set.concat([3, 4, 2]);

    expect(s).toEqual([1, 2, 3, 4] as any);
  });
});
