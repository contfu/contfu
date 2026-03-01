import { describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import {
  safeCast,
  typeCompatibility,
  autoWireMappings,
  applyMappings,
  applyMappingsToSchema,
  type MappingRule,
} from "./mappings";

const T = PropertyType;

describe("safeCast", () => {
  test("direct overlap returns null", () => {
    expect(safeCast(T.STRING, T.STRING)).toBeNull();
  });

  test.each([
    [T.NUMBER, T.STRING, "string"],
    [T.NUMBERS, T.STRINGS, "string"],
    [T.REF, T.STRING, "string"],
    [T.REFS, T.STRINGS, "string"],
    [T.BOOLEAN, T.STRING, "string"],
    [T.DATE, T.STRING, "string"],
  ] as const)("safe cast %p → %p returns %p", (src, tgt, expected) => {
    expect(safeCast(src, tgt)).toBe(expected);
  });

  test.each([
    [T.STRING, T.NUMBER],
    [T.FILE, T.STRING],
    [T.STRING, T.BOOLEAN],
  ] as const)("incompatible %p → %p returns null", (src, tgt) => {
    expect(safeCast(src, tgt)).toBeNull();
  });

  test("bitmask overlap wins over safe cast", () => {
    // target accepts STRING|NUMBER, source is NUMBER → direct overlap
    expect(safeCast(T.NUMBER, T.STRING | T.NUMBER)).toBeNull();
  });
});

describe("typeCompatibility", () => {
  test("direct match", () => {
    expect(typeCompatibility(T.STRING, T.STRING)).toEqual({
      compatible: true,
      cast: null,
    });
  });

  test("safe cast exists", () => {
    expect(typeCompatibility(T.NUMBER, T.STRING)).toEqual({
      compatible: true,
      cast: "string",
    });
  });

  test("incompatible", () => {
    expect(typeCompatibility(T.STRING, T.NUMBER)).toEqual({
      compatible: false,
    });
  });
});

describe("autoWireMappings", () => {
  test("exact name + same type", () => {
    const rules = autoWireMappings({ title: T.STRING }, { title: T.STRING });
    expect(rules).toEqual([{ source: "title", target: "title" }]);
  });

  test("exact name + safe cast", () => {
    const rules = autoWireMappings({ count: T.STRING }, { count: T.NUMBER });
    expect(rules).toEqual([{ source: "count", target: "count", cast: "string", guessed: true }]);
  });

  test("synonym match + same type", () => {
    const rules = autoWireMappings({ title: T.STRING }, { name: T.STRING });
    expect(rules).toEqual([{ source: "name", target: "title", guessed: true }]);
  });

  test("synonym match + cast", () => {
    const rules = autoWireMappings({ title: T.STRING }, { name: T.NUMBER });
    expect(rules).toEqual([{ source: "name", target: "title", cast: "string", guessed: true }]);
  });

  test("no match → omitted", () => {
    const rules = autoWireMappings({ title: T.STRING }, { unrelated: T.STRING });
    expect(rules).toEqual([]);
  });

  test("incompatible types with matching name → not mapped", () => {
    const rules = autoWireMappings({ title: T.NUMBER }, { title: T.STRING });
    expect(rules).toEqual([]);
  });

  test("scoring priority: exact+direct beats others", () => {
    const rules = autoWireMappings({ title: T.STRING }, { title: T.STRING, name: T.STRING });
    expect(rules).toEqual([{ source: "title", target: "title" }]);
  });

  test("scoring priority: exact+cast beats synonym+direct", () => {
    const rules = autoWireMappings({ title: T.STRING }, { title: T.NUMBER, name: T.STRING });
    expect(rules).toEqual([{ source: "title", target: "title", cast: "string", guessed: true }]);
  });

  test("empty schemas → empty rules", () => {
    expect(autoWireMappings({}, {})).toEqual([]);
  });

  test("multiple target properties get independent matches", () => {
    const rules = autoWireMappings(
      { title: T.STRING, slug: T.STRING },
      { title: T.STRING, path: T.STRING },
    );
    expect(rules).toHaveLength(2);
    expect(rules).toContainEqual({ source: "title", target: "title" });
    expect(rules).toContainEqual({
      source: "path",
      target: "slug",
      guessed: true,
    });
  });
});

describe("applyMappings", () => {
  test("passes through unchanged when mappings is null", () => {
    const props = { title: "Hello", views: 42 };
    expect(applyMappings(props, null)).toBe(props);
  });

  test("passes through unchanged when mappings is empty", () => {
    const props = { title: "Hello" };
    expect(applyMappings(props, [])).toBe(props);
  });

  test("renames properties according to rules", () => {
    const props = { heading: "Hello", rating: 5 };
    const mappings: MappingRule[] = [
      { source: "heading", target: "title" },
      { source: "rating", target: "score" },
    ];
    expect(applyMappings(props, mappings)).toEqual({ title: "Hello", score: 5 });
  });

  test("uses source as target when target is omitted", () => {
    const props = { title: "Hello" };
    const mappings: MappingRule[] = [{ source: "title" }];
    expect(applyMappings(props, mappings)).toEqual({ title: "Hello" });
  });

  test("drops unmapped source properties", () => {
    const props = { title: "Hello", extra: "dropped" };
    const mappings: MappingRule[] = [{ source: "title", target: "title" }];
    expect(applyMappings(props, mappings)).toEqual({ title: "Hello" });
  });

  test("skips rule when source key is missing and no default", () => {
    const props = { title: "Hello" };
    const mappings: MappingRule[] = [
      { source: "title", target: "title" },
      { source: "missing", target: "gone" },
    ];
    expect(applyMappings(props, mappings)).toEqual({ title: "Hello" });
  });

  test("uses default when source key is missing", () => {
    const props = {};
    const mappings: MappingRule[] = [{ source: "missing", target: "filled", default: "fallback" }];
    expect(applyMappings(props, mappings)).toEqual({ filled: "fallback" });
  });

  test("applies string cast", () => {
    const props = { views: 42 };
    const mappings: MappingRule[] = [{ source: "views", target: "score", cast: "string" }];
    expect(applyMappings(props, mappings)).toEqual({ score: "42" });
  });

  test("applies number cast", () => {
    const props = { count: "7" };
    const mappings: MappingRule[] = [{ source: "count", target: "count", cast: "number" }];
    expect(applyMappings(props, mappings)).toEqual({ count: 7 });
  });

  test("applies boolean cast", () => {
    const props = { flag: 1 };
    const mappings: MappingRule[] = [{ source: "flag", target: "flag", cast: "boolean" }];
    expect(applyMappings(props, mappings)).toEqual({ flag: true });
  });

  test("ignores unknown cast", () => {
    const props = { x: 42 };
    const mappings: MappingRule[] = [{ source: "x", target: "x", cast: "unknown" }];
    expect(applyMappings(props, mappings)).toEqual({ x: 42 });
  });
});

describe("applyMappingsToSchema", () => {
  test("passes through unchanged when mappings is null", () => {
    const schema = { title: T.STRING };
    expect(applyMappingsToSchema(schema, null)).toBe(schema);
  });

  test("passes through unchanged when mappings is empty", () => {
    const schema = { title: T.STRING };
    expect(applyMappingsToSchema(schema, [])).toBe(schema);
  });

  test("remaps schema keys", () => {
    const schema = { heading: T.STRING, rating: T.NUMBER };
    const mappings: MappingRule[] = [
      { source: "heading", target: "title" },
      { source: "rating", target: "score" },
    ];
    expect(applyMappingsToSchema(schema, mappings)).toEqual({
      title: T.STRING,
      score: T.NUMBER,
    });
  });

  test("drops unmapped schema keys", () => {
    const schema = { title: T.STRING, extra: T.NUMBER };
    const mappings: MappingRule[] = [{ source: "title", target: "title" }];
    expect(applyMappingsToSchema(schema, mappings)).toEqual({ title: T.STRING });
  });

  test("skips rule when source key not in schema", () => {
    const schema = { title: T.STRING };
    const mappings: MappingRule[] = [
      { source: "title", target: "title" },
      { source: "missing", target: "gone" },
    ];
    expect(applyMappingsToSchema(schema, mappings)).toEqual({ title: T.STRING });
  });
});
