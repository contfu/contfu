import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Heading1Block, ImageBlock } from "@contfu/core";
import { createHttpTypedClient, serializeQueryParams } from "./query-client";

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
    const params = serializeQueryParams({ include: ["files", "links"] });
    expect(params.get("include")).toBe("files,links");
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

  test("omits contentAs, htmlOptions, markdownOptions", () => {
    const params = serializeQueryParams({
      contentAs: "markdown",
      htmlOptions: { file: { baseUrl: "/x" } },
      markdownOptions: { file: { baseUrl: "/x" } },
    });
    expect(params.has("contentAs")).toBe(false);
    expect(params.has("htmlOptions")).toBe(false);
    expect(params.has("markdownOptions")).toBe(false);
  });
});

describe("createHttpTypedClient contentAs", () => {
  const originalFetch = globalThis.fetch;
  let lastUrl = "";

  beforeEach(() => {
    lastUrl = "";
    globalThis.fetch = ((url: string) => {
      lastUrl = url;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                $id: "a",
                $collection: "articles",
                $changedAt: 0,
                links: [],
                content: [
                  ["1", ["Hello"]],
                  ["p", ["world"]],
                ],
              },
            ],
            meta: { total: 1, limit: 20, offset: 0 },
          }),
      } as Response);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("default returns block content unchanged", async () => {
    const client = createHttpTypedClient("http://x");
    const res = await client("articles");
    expect(Array.isArray(res[0].content)).toBe(true);
    expect(res[0].content[0]).toEqual(["1", ["Hello"]]);
  });

  test("contentAs markdown renders content to string and auto-includes content", async () => {
    const client = createHttpTypedClient("http://x");
    const res = await client("articles", { contentAs: "markdown" });
    expect(typeof res[0].content).toBe("string");
    expect(res[0].content).toContain("# Hello");
    const url = new URL(lastUrl);
    expect(url.searchParams.get("include")).toBe("content");
  });

  test("contentAs html renders content to html string", async () => {
    const client = createHttpTypedClient("http://x");
    const res = await client("articles", { contentAs: "html" });
    expect(typeof res[0].content).toBe("string");
    expect(res[0].content).toBe("<h1>Hello</h1><p>world</p>");
  });

  test("contentAs html uses htmlOptions custom renderer", async () => {
    const client = createHttpTypedClient("http://x");
    const res = await client("articles", {
      contentAs: "html",
      htmlOptions: { blocks: { h1: (b: Heading1Block) => `<H1>${String(b[1][0])}</H1>` } },
    });
    expect(res[0].content).toBe("<H1>Hello</H1><p>world</p>");
  });

  test("contentAs preserves existing include entries", async () => {
    const client = createHttpTypedClient("http://x");
    await client("articles", { contentAs: "markdown", include: ["files", "links"] });
    const url = new URL(lastUrl);
    expect(url.searchParams.get("include")).toBe("files,links,content");
  });

  test("contentAs object leaves include untouched", async () => {
    const client = createHttpTypedClient("http://x");
    await client("articles", { contentAs: "object" });
    const url = new URL(lastUrl);
    expect(url.searchParams.has("include")).toBe(false);
  });
});

describe("createHttpTypedClient markdownOptions", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                $id: "a",
                $collection: "articles",
                $changedAt: 0,
                links: [],
                content: [["i", "abc.png", "cat"]],
              },
            ],
            meta: { total: 1, limit: 20, offset: 0 },
          }),
      } as Response)) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("markdown img uses default /files base", async () => {
    const client = createHttpTypedClient("http://x");
    const res = await client("articles", { contentAs: "markdown" });
    expect(res[0].content).toBe("![cat](/files/abc.png)");
  });

  test("markdown img honors markdownOptions.file.baseUrl", async () => {
    const client = createHttpTypedClient("http://x");
    const res = await client("articles", {
      contentAs: "markdown",
      markdownOptions: { file: { baseUrl: "https://cdn/x" } },
    });
    expect(res[0].content).toBe("![cat](https://cdn/x/abc.png)");
  });

  test("markdown custom block renderer wins", async () => {
    const client = createHttpTypedClient("http://x");
    const res = await client("articles", {
      contentAs: "markdown",
      markdownOptions: { blocks: { img: (b: ImageBlock) => `[IMG:${b[1]}:${b[2]}]` } },
    });
    expect(res[0].content).toBe("[IMG:abc.png:cat]");
  });
});
