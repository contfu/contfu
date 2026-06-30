import { describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import type { MappingRule } from "@contfu/svc-core";
import {
  autoWireMappings,
  applyMappings,
  applyMappingsToSchema,
  withExplicitRefMappingInput,
  validateSourceItem,
} from "./mapping-ops";

const T = PropertyType;

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

  test("ignores $draft schema keys", () => {
    const rules = autoWireMappings(
      { $draft: T.BOOLEAN, title: T.STRING },
      { $draft: T.BOOLEAN, title: T.STRING },
    );
    expect(rules).toEqual([{ source: "title", target: "title" }]);
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

  test("does not preserve $ref implicitly with explicit mappings", () => {
    const props = { title: "Hello", $ref: "https://cms.test/items/1", $locale: "en" };
    const mappings: MappingRule[] = [{ source: "title", target: "title" }];
    expect(applyMappings(props, mappings)).toEqual({ title: "Hello", $locale: "en" });
  });

  test("maps $ref when explicitly requested", () => {
    const props = withExplicitRefMappingInput(
      { title: "Hello" },
      [{ source: "$ref", target: "upstreamUrl" }],
      "https://cms.test/items/1",
    );
    expect(applyMappings(props, [{ source: "$ref", target: "upstreamUrl" }])).toEqual({
      upstreamUrl: "https://cms.test/items/1",
    });
  });

  test("selects array items from the start", () => {
    expect(
      applyMappings({ tags: ["first", "second", "third"] }, [
        { source: "tags", target: "firstTag", arrayIndex: 0 },
        { source: "tags", target: "secondTag", arrayIndex: 1 },
      ]),
    ).toEqual({ firstTag: "first", secondTag: "second" });
  });

  test("selects array items from the end", () => {
    expect(
      applyMappings({ tags: ["first", "second", "third"] }, [
        { source: "tags", target: "lastTag", arrayIndex: -1 },
        { source: "tags", target: "secondLastTag", arrayIndex: -2 },
      ]),
    ).toEqual({ lastTag: "third", secondLastTag: "second" });
  });

  test("falls back to default for out-of-range array selections", () => {
    expect(
      applyMappings({ tags: ["first"] }, [
        { source: "tags", target: "missing", arrayIndex: 3, default: "fallback" },
      ]),
    ).toEqual({ missing: "fallback" });
  });

  test("skips out-of-range array selections without a default", () => {
    expect(
      applyMappings({ tags: ["first"] }, [{ source: "tags", target: "missing", arrayIndex: -2 }]),
    ).toEqual({});
  });

  test("rejects non-integer array selections", () => {
    expect(
      applyMappings({ tags: ["first", "second"] }, [
        { source: "tags", target: "tag", arrayIndex: 0.5 },
      ]),
    ).toEqual({});
    expect(
      applyMappings({ tags: ["first", "second"] }, [
        { source: "tags", target: "tag", arrayIndex: 0.5, default: "fallback" },
      ]),
    ).toEqual({ tag: "fallback" });
  });

  test("treats scalar source values as the singleton for first or last selection", () => {
    expect(
      applyMappings({ tag: "featured" }, [
        { source: "tag", target: "firstTag", arrayIndex: 0 },
        { source: "tag", target: "lastTag", arrayIndex: -1 },
      ]),
    ).toEqual({ firstTag: "featured", lastTag: "featured" });
  });

  test("falls back for scalar source values when selecting a non-singleton index", () => {
    expect(
      applyMappings({ tag: "featured" }, [
        { source: "tag", target: "secondTag", arrayIndex: 1, default: "fallback" },
      ]),
    ).toEqual({ secondTag: "fallback" });
  });

  test("selects file array items", () => {
    const files = [
      { id: "file-a", name: "a.png" },
      { id: "file-b", name: "b.png" },
    ];
    expect(
      applyMappings({ gallery: files }, [
        { source: "gallery", target: "cover", arrayIndex: 0 },
        { source: "gallery", target: "trailer", arrayIndex: -1 },
      ]),
    ).toEqual({ cover: files[0], trailer: files[1] });
  });

  test("selects number, ref, and enum array items", () => {
    expect(
      applyMappings({ scores: [1, 2], refs: ["a", "b"], statuses: ["draft", "published"] }, [
        { source: "scores", target: "score", arrayIndex: 1 },
        { source: "refs", target: "ref", arrayIndex: -1 },
        { source: "statuses", target: "status", arrayIndex: 0 },
      ]),
    ).toEqual({ score: 2, ref: "b", status: "draft" });
  });

  test("casts after selecting an array item", () => {
    expect(
      applyMappings({ counts: ["7", "11"] }, [
        { source: "counts", target: "count", arrayIndex: 1, cast: "number" },
      ]),
    ).toEqual({ count: 11 });
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

  test("validates the selected array item before casting", () => {
    const errors = validateSourceItem({ values: ["42", "bad"] }, [
      { source: "values", target: "score", cast: "number", arrayIndex: 0 },
    ]);
    expect(errors).toEqual([]);

    const failing = validateSourceItem({ values: ["42", "bad"] }, [
      { source: "values", target: "score", cast: "number", arrayIndex: 1 },
    ]);
    expect(failing).toEqual([{ property: "score", sourceProperty: "values", cast: "number" }]);
  });

  test("validates scalar singleton values selected with first or last index", () => {
    expect(
      validateSourceItem({ value: "42" }, [
        { source: "value", target: "score", cast: "number", arrayIndex: -1 },
      ]),
    ).toEqual([]);
    expect(
      validateSourceItem({ value: "bad" }, [
        { source: "value", target: "score", cast: "number", arrayIndex: 0 },
      ]),
    ).toEqual([{ property: "score", sourceProperty: "value", cast: "number" }]);
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

  test("drops $ref from pass-through schemas unless explicitly mapped", () => {
    const schema = { title: T.STRING, $ref: T.STRING };
    expect(applyMappingsToSchema(schema, null)).toEqual({ title: T.STRING });
    expect(applyMappingsToSchema(schema, [])).toEqual({ title: T.STRING });
    expect(applyMappingsToSchema(schema, [{ source: "$ref", target: "upstreamUrl" }])).toEqual({
      upstreamUrl: T.STRING,
    });
  });

  test("preserves $draft without mapping it", () => {
    const schema = { $draft: T.BOOLEAN, title: T.STRING, extra: T.NUMBER };
    const mappings: MappingRule[] = [
      { source: "$draft", target: "draft" },
      { source: "title", target: "title" },
    ];
    expect(applyMappingsToSchema(schema, mappings)).toEqual({
      $draft: T.BOOLEAN,
      title: T.STRING,
    });
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

  test("does not demote array schema values for non-integer indexes", () => {
    const schema = { tags: T.STRINGS };
    expect(
      applyMappingsToSchema(schema, [{ source: "tags", target: "tag", arrayIndex: 0.5 }]),
    ).toEqual({ tag: T.STRINGS });
  });

  test("demotes selected array schema values to singleton values", () => {
    const schema = {
      titles: T.STRINGS | T.NULL,
      scores: T.NUMBERS,
      refs: T.REFS,
      files: T.FILES,
      status: [T.ENUMS | T.NULL, ["draft", "published"]] as [number, string[]],
    };
    const result = applyMappingsToSchema(schema, [
      { source: "titles", target: "title", arrayIndex: 0 },
      { source: "scores", target: "score", arrayIndex: 1 },
      { source: "refs", target: "ref", arrayIndex: -1 },
      { source: "files", target: "file", arrayIndex: 0 },
      { source: "status", target: "status", arrayIndex: 0 },
    ]);
    expect(result).toEqual({
      title: T.STRING | T.NULL,
      score: T.NUMBER,
      ref: T.REF,
      file: T.FILE,
      status: [T.ENUM | T.NULL, ["draft", "published"]],
    });
  });
});
