import { describe, it, expect } from "bun:test";
import {
  createItemRef,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  notLike,
  contains,
  type FieldRef,
} from "./filter-helpers";

// Type-level test setup
type TestProps = {
  title: string;
  rank: number;
  published: boolean;
  status: "draft" | "published";
  tags: string[];
  categories: ("a" | "b")[];
};

const self = createItemRef<TestProps>(0);

describe("filter-helpers operator type safety", () => {
  // eq tests
  it("eq with string field and string value", () => {
    const result = eq(self.title, "hello");
    expect(typeof result).toBe("string");
  });

  it("eq with string field and null", () => {
    const result = eq(self.title, null);
    expect(typeof result).toBe("string");
  });

  it("eq with number field and number value", () => {
    const result = eq(self.rank, 42);
    expect(typeof result).toBe("string");
  });

  it("eq with number field and null", () => {
    const result = eq(self.rank, null);
    expect(typeof result).toBe("string");
  });

  it("eq with boolean field and boolean value", () => {
    const result = eq(self.published, true);
    expect(typeof result).toBe("string");
  });

  it("eq with enum field and enum value", () => {
    const result = eq(self.status, "draft");
    expect(typeof result).toBe("string");
  });

  // Type error cases (using @ts-expect-error)
  it("eq with string field rejects number value", () => {
    // @ts-expect-error
    const _: string = eq(self.title, 42);
  });

  it("eq with number field rejects string value", () => {
    // @ts-expect-error
    const _: string = eq(self.rank, "invalid");
  });

  it("eq with boolean field rejects number value", () => {
    // @ts-expect-error
    const _: string = eq(self.published, 1);
  });

  it("eq with enum field accepts enum value", () => {
    const result = eq(self.status, "published");
    expect(typeof result).toBe("string");
  });

  // ne tests (same constraints as eq)
  it("ne with string field and string value", () => {
    const result = ne(self.title, "hello");
    expect(typeof result).toBe("string");
  });

  it("ne with string field rejects number value", () => {
    // @ts-expect-error
    const _: string = ne(self.title, 42);
  });

  // gt/gte/lt/lte tests (numeric and string fields only)
  it("gt with number field", () => {
    const result = gt(self.rank, 10);
    expect(typeof result).toBe("string");
  });

  it("gte with number field", () => {
    const result = gte(self.rank, 10);
    expect(typeof result).toBe("string");
  });

  it("lt with number field", () => {
    const result = lt(self.rank, 100);
    expect(typeof result).toBe("string");
  });

  it("lte with number field", () => {
    const result = lte(self.rank, 100);
    expect(typeof result).toBe("string");
  });

  it("gt with string field", () => {
    const result = gt(self.title, "a");
    expect(typeof result).toBe("string");
  });

  it("gt with boolean field rejects", () => {
    // @ts-expect-error boolean is not Comparable
    const _: string = gt(self.published, true);
  });

  // like/notLike tests (string fields only)
  it("like with string field", () => {
    const result = like(self.title, "%foo%");
    expect(typeof result).toBe("string");
  });

  it("notLike with string field", () => {
    const result = notLike(self.title, "%bar%");
    expect(typeof result).toBe("string");
  });

  it("like with number field rejects", () => {
    // @ts-expect-error number field can't use like
    const _: string = like(self.rank, "%foo%");
  });

  it("like with boolean field rejects", () => {
    // @ts-expect-error boolean field can't use like
    const _: string = like(self.published, "%foo%");
  });

  // contains tests (array fields only, element type constraint)
  it("contains with string array field and string value", () => {
    const result = contains(self.tags, "tag1");
    expect(typeof result).toBe("string");
  });

  it("contains with enum array field and enum value", () => {
    const result = contains(self.categories, "a");
    expect(typeof result).toBe("string");
  });

  it("contains with string array field rejects number value", () => {
    // @ts-expect-error element type must match
    const _: string = contains(self.tags, 42);
  });

  it("contains with enum array field accepts enum value", () => {
    const result = contains(self.categories, "a");
    expect(typeof result).toBe("string");
  });

  it("contains with non-array field rejects", () => {
    // @ts-expect-error can't use contains on non-array field
    const _: string = contains(self.title, "hello");
  });

  // System fields with correct types
  it("eq with $id (string system field)", () => {
    const result = eq(self.$id, "item-123");
    expect(typeof result).toBe("string");
  });

  it("eq with $changedAt (number system field)", () => {
    const result = eq(self.$changedAt, 1234567890);
    expect(typeof result).toBe("string");
  });

  it("gt with $changedAt (timestamp comparison)", () => {
    const result = gt(self.$changedAt, 1234567890);
    expect(typeof result).toBe("string");
  });

  it("eq with $connectionType (string|null system field)", () => {
    const result = eq(self.$connectionType, "notion");
    expect(typeof result).toBe("string");
  });

  it("eq with $connectionType null", () => {
    const result = eq(self.$connectionType, null);
    expect(typeof result).toBe("string");
  });

  // Untyped field refs (fallback overload path)
  it("eq with untyped FieldRef still works", () => {
    const untypedRef: FieldRef = { path: "someField" } as any;
    // This should work via the fallback overload (non-FieldRef first arg excluded)
    // Since untypedRef is FieldRef<unknown>, the typed overload matches with T=unknown
    const result = eq(untypedRef, "any value");
    expect(typeof result).toBe("string");
  });

  // Edge case: mixed field refs (second arg can be a FieldRef in some cases)
  it("eq with two field refs (both string)", () => {
    const result = eq(self.title, self.title);
    expect(typeof result).toBe("string");
  });

  it("eq with FieldRef<T> and FieldRef<T> different fields (same type)", () => {
    const self2 = createItemRef<{ name: string; description: string }>(0);
    const result = eq(self2.name, self2.description);
    expect(typeof result).toBe("string");
  });
});
