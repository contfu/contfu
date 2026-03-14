import { describe, expect, test } from "bun:test";
import { deserializeQueryParams, serializeQueryParams } from "./query-client";

describe("serializeQueryParams", () => {
  test("serializes filter", () => {
    const params = serializeQueryParams({ filter: '$collection = "articles"' });
    expect(params.get("filter")).toBe('$collection = "articles"');
  });

  test("serializes sort as string", () => {
    const params = serializeQueryParams({ sort: "-$changedAt" });
    expect(params.get("sort")).toBe("-$changedAt");
  });

  test("serializes sort as array", () => {
    const params = serializeQueryParams({ sort: ["-$changedAt", "$collection"] });
    expect(params.get("sort")).toBe("-$changedAt,$collection");
  });

  test("serializes sort as object", () => {
    const params = serializeQueryParams({
      sort: { field: "$changedAt", direction: "desc" },
    });
    expect(params.get("sort")).toBe("-$changedAt");
  });

  test("serializes limit and offset", () => {
    const params = serializeQueryParams({ limit: 10, offset: 20 });
    expect(params.get("limit")).toBe("10");
    expect(params.get("offset")).toBe("20");
  });

  test("serializes include", () => {
    const params = serializeQueryParams({ include: ["assets", "links"] });
    expect(params.get("include")).toBe("assets,links");
  });

  test("serializes with as JSON", () => {
    const params = serializeQueryParams({
      with: { related: { filter: "$collection = $1.$collection" } },
    });
    const parsed = JSON.parse(params.get("with")!);
    expect(parsed.related.filter).toBe("$collection = $1.$collection");
  });

  test("serializes search", () => {
    const params = serializeQueryParams({ search: "hello" });
    expect(params.get("search")).toBe("hello");
  });

  test("omits undefined values", () => {
    const params = serializeQueryParams({});
    expect(params.toString()).toBe("");
  });

  test("serializes fields including empty array", () => {
    expect(serializeQueryParams({ fields: ["title", "$ref"] }).get("fields")).toBe("title,$ref");
    expect(serializeQueryParams({ fields: [] }).get("fields")).toBe("");
  });
});

describe("deserializeQueryParams", () => {
  test("deserializes filter", () => {
    const params = new URLSearchParams({ filter: '$collection = "articles"' });
    const options = deserializeQueryParams(params);
    expect(options.filter).toBe('$collection = "articles"');
  });

  test("deserializes sort", () => {
    const params = new URLSearchParams({ sort: "-$changedAt,$collection" });
    const options = deserializeQueryParams(params);
    expect(options.sort).toEqual(["-$changedAt", "$collection"]);
  });

  test("deserializes limit and offset", () => {
    const params = new URLSearchParams({ limit: "10", offset: "20" });
    const options = deserializeQueryParams(params);
    expect(options.limit).toBe(10);
    expect(options.offset).toBe(20);
  });

  test("deserializes include", () => {
    const params = new URLSearchParams({ include: "assets,links" });
    const options = deserializeQueryParams(params);
    expect(options.include).toEqual(["assets", "links"]);
  });

  test("deserializes with JSON", () => {
    const params = new URLSearchParams({
      with: JSON.stringify({ related: { filter: "$collection = $1.$collection" } }),
    });
    const options = deserializeQueryParams(params);
    expect(options.with!.related.filter).toBe("$collection = $1.$collection");
  });

  test("roundtrips through serialize/deserialize", () => {
    const original = {
      filter: '$collection = "articles"',
      sort: ["-$changedAt"] as string[],
      limit: 10,
      offset: 5,
      include: ["assets" as const, "links" as const],
      search: "test",
      fields: ["title", "$ref"],
    };

    const params = serializeQueryParams(original);
    const result = deserializeQueryParams(params);

    expect(result.filter).toBe(original.filter);
    expect(result.sort).toEqual(original.sort);
    expect(result.limit).toBe(original.limit);
    expect(result.offset).toBe(original.offset);
    expect(result.include).toEqual(original.include);
    expect(result.search).toBe(original.search);
  });

  test("deserializes empty fields array", () => {
    const params = new URLSearchParams({ fields: "" });
    const options = deserializeQueryParams(params);
    expect(options.fields).toEqual([]);
  });
});
