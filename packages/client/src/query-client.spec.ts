import { describe, expect, test } from "bun:test";
import { serializeQueryParams } from "./query-client";

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
