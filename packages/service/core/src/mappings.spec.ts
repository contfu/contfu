import { describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import {
  safeCast,
  typeCompatibility,
  autoWireMappings,
  applyMappings,
  applyMappingsToSchema,
  validateSourceItem,
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

describe("validateSourceItem", () => {
  test("returns error for non-numeric string with number cast", () => {
    const errors = validateSourceItem({ views: "arb" }, [
      { source: "views", target: "score", cast: "number" },
    ]);
    expect(errors).toEqual([{ property: "score", sourceProperty: "views", cast: "number" }]);
  });

  test("returns no error for valid number string", () => {
    const errors = validateSourceItem({ views: "42" }, [
      { source: "views", target: "score", cast: "number" },
    ]);
    expect(errors).toEqual([]);
  });

  test("returns no error for actual number value", () => {
    const errors = validateSourceItem({ views: 42 }, [
      { source: "views", target: "score", cast: "number" },
    ]);
    expect(errors).toEqual([]);
  });

  test("multiple failing properties return multiple errors", () => {
    const errors = validateSourceItem({ a: "bad", b: "worse" }, [
      { source: "a", target: "x", cast: "number" },
      { source: "b", target: "y", cast: "number" },
    ]);
    expect(errors).toHaveLength(2);
  });

  test("no cast rules return no errors", () => {
    const errors = validateSourceItem({ title: "Hello" }, [{ source: "title", target: "title" }]);
    expect(errors).toEqual([]);
  });

  test("missing source prop with no default is skipped", () => {
    const errors = validateSourceItem({}, [{ source: "missing", target: "score", cast: "number" }]);
    expect(errors).toEqual([]);
  });

  test("null or empty mappings return no errors", () => {
    expect(validateSourceItem({ x: 1 }, null)).toEqual([]);
    expect(validateSourceItem({ x: 1 }, [])).toEqual([]);
  });

  test("validates default value when source prop is missing", () => {
    const errors = validateSourceItem({}, [
      { source: "missing", target: "score", cast: "number", default: "not-a-number" },
    ]);
    expect(errors).toEqual([{ property: "score", sourceProperty: "missing", cast: "number" }]);
  });
});

describe("ENUM/ENUMS safe casts", () => {
  test("STRING → ENUM cast is 'enum'", () => {
    expect(safeCast(T.STRING, T.ENUM)).toBe("enum");
  });

  test("STRINGS → ENUMS cast is 'enum'", () => {
    expect(safeCast(T.STRINGS, T.ENUMS)).toBe("enum");
  });

  test("ENUM → STRING cast is 'string'", () => {
    expect(safeCast(T.ENUM, T.STRING)).toBe("string");
  });

  test("ENUMS → STRINGS cast is 'string'", () => {
    expect(safeCast(T.ENUMS, T.STRINGS)).toBe("string");
  });

  test("ENUM is compatible with ENUM", () => {
    expect(typeCompatibility(T.ENUM, T.ENUM)).toEqual({ compatible: true, cast: null });
  });

  test("ENUMS is compatible with ENUMS", () => {
    expect(typeCompatibility(T.ENUMS, T.ENUMS)).toEqual({ compatible: true, cast: null });
  });
});

describe("autoWireMappings with ENUM schema values", () => {
  test("ENUM source matches ENUM target directly", () => {
    const source = { status: [T.ENUM | T.NULL, ["draft", "published"]] as [number, string[]] };
    const target = { status: [T.ENUM | T.NULL, ["draft", "published"]] as [number, string[]] };
    const rules = autoWireMappings(target, source);
    expect(rules).toEqual([{ source: "status", target: "status" }]);
  });

  test("ENUM source matches STRING target via 'string' cast", () => {
    const source = { status: [T.ENUM | T.NULL, ["a", "b"]] as [number, string[]] };
    const target = { status: T.STRING | T.NULL };
    const rules = autoWireMappings(target, source);
    expect(rules).toEqual([{ source: "status", target: "status", cast: "string", guessed: true }]);
  });
});

describe("validateSourceItem with enum cast", () => {
  test("passes when value is in enum list (via targetSchema)", () => {
    const errors = validateSourceItem({ status: "draft" }, [{ source: "status", cast: "enum" }], {
      status: [T.ENUM, ["draft", "published"]],
    });
    expect(errors).toEqual([]);
  });

  test("fails when value is not in enum list (via targetSchema)", () => {
    const errors = validateSourceItem({ status: "invalid" }, [{ source: "status", cast: "enum" }], {
      status: [T.ENUM, ["draft", "published"]],
    });
    expect(errors).toEqual([{ property: "status", sourceProperty: "status", cast: "enum" }]);
  });

  test("passes when value is in rule.enumValues", () => {
    const errors = validateSourceItem({ status: "active" }, [
      { source: "status", cast: "enum", enumValues: ["active", "inactive"] },
    ]);
    expect(errors).toEqual([]);
  });

  test("fails when value is not in rule.enumValues", () => {
    const errors = validateSourceItem({ status: "unknown" }, [
      { source: "status", cast: "enum", enumValues: ["active", "inactive"] },
    ]);
    expect(errors).toEqual([{ property: "status", sourceProperty: "status", cast: "enum" }]);
  });

  test("skips null values for enum cast", () => {
    const errors = validateSourceItem({ status: null }, [
      { source: "status", cast: "enum", enumValues: ["active"] },
    ]);
    expect(errors).toEqual([]);
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

  test("skips rule when source key not in schema and no default", () => {
    const schema = { title: T.STRING };
    const mappings: MappingRule[] = [
      { source: "title", target: "title" },
      { source: "missing", target: "gone" },
    ];
    expect(applyMappingsToSchema(schema, mappings)).toEqual({ title: T.STRING });
  });

  test("injects constant enum entry when source absent but default is set", () => {
    const schema = { name: T.STRING };
    const mappings: MappingRule[] = [
      { source: "name", target: "name" },
      { source: "", target: "type", cast: "enum", default: "topic" },
    ];
    const result = applyMappingsToSchema(schema, mappings);
    expect(result.name).toBe(T.STRING);
    expect(Array.isArray(result.type)).toBe(true);
    expect((result.type as [number, string[]])[0]).toBe(T.ENUM);
    expect((result.type as [number, string[]])[1]).toEqual(["topic"]);
  });

  test("injects constant string entry as enum literal when source absent but default is set", () => {
    const schema = { name: T.STRING };
    const mappings: MappingRule[] = [
      { source: "name", target: "name" },
      { source: "", target: "source", default: "web" },
    ];
    const result = applyMappingsToSchema(schema, mappings);
    expect(Array.isArray(result.source)).toBe(true);
    expect((result.source as [number, string[]])[0]).toBe(T.ENUM);
    expect((result.source as [number, string[]])[1]).toEqual(["web"]);
  });

  test("injects constant number entry when source absent but number default is set", () => {
    const schema = { name: T.STRING };
    const mappings: MappingRule[] = [
      { source: "name", target: "name" },
      { source: "", target: "priority", default: 1 },
    ];
    const result = applyMappingsToSchema(schema, mappings);
    expect(result.priority).toBe(T.NUMBER);
  });

  test("preserves enum tuple when remapping schema keys", () => {
    const schema = { status: [T.ENUM | T.NULL, ["draft", "published"]] as [number, string[]] };
    const mappings: MappingRule[] = [{ source: "status", target: "articleStatus" }];
    const result = applyMappingsToSchema(schema, mappings);
    expect(result).toEqual({
      articleStatus: [T.ENUM | T.NULL, ["draft", "published"]],
    });
  });

  test("converts STRING to ENUM schema value when cast is 'enum'", () => {
    const schema = { type: T.STRING | T.NULL };
    const mappings: MappingRule[] = [
      { source: "type", target: "type", cast: "enum", enumValues: ["blog", "page"] },
    ];
    const result = applyMappingsToSchema(schema, mappings);
    expect(Array.isArray(result.type)).toBe(true);
    expect((result.type as [number, string[]])[0]).toBe(T.ENUM | T.NULL);
    expect((result.type as [number, string[]])[1]).toEqual(["blog", "page"]);
  });

  test("merges enum values when two source properties map to the same target", () => {
    const schema = {
      statusA: [T.ENUM | T.NULL, ["draft", "published"]] as [number, string[]],
      statusB: [T.ENUM | T.NULL, ["active", "inactive"]] as [number, string[]],
    };
    const mappings: MappingRule[] = [
      { source: "statusA", target: "status" },
      { source: "statusB", target: "status" },
    ];
    const result = applyMappingsToSchema(schema, mappings);
    expect(Array.isArray(result.status)).toBe(true);
    const vals = (result.status as [number, string[]])[1];
    expect(vals).toContain("draft");
    expect(vals).toContain("published");
    expect(vals).toContain("active");
    expect(vals).toContain("inactive");
  });
});
