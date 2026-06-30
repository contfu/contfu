import { describe, expect, it } from "bun:test";
import {
  normalizeIncludedFileMetadata,
  normalizeFileMetadata,
  normalizeQueryArgs,
  QueryResultArray,
  resolveQueryFilter,
  resolveQueryWithFunctions,
} from "./query-types";

describe("normalizeQueryArgs", () => {
  it("turns a collection argument into collection options", () => {
    expect(normalizeQueryArgs("posts")).toEqual({ options: { collection: "posts" } });
  });

  it("treats string and function second arguments as filters", () => {
    const filterFn = () => 'title = "Hello"';

    expect(normalizeQueryArgs("posts", 'title = "Hello"')).toEqual({
      options: { collection: "posts", filter: 'title = "Hello"' },
    });
    expect(normalizeQueryArgs("posts", filterFn)).toEqual({
      options: { collection: "posts", filter: filterFn },
    });
  });

  it("merges option objects with the collection argument", () => {
    expect(normalizeQueryArgs("posts", { limit: 10, fields: ["title"] })).toEqual({
      options: { collection: "posts", limit: 10, fields: ["title"] },
    });
  });

  it("passes option objects through and defaults missing args to empty options", () => {
    const options = { limit: 5 };

    expect(normalizeQueryArgs(options)).toEqual({ options });
    expect(normalizeQueryArgs()).toEqual({ options: {} });
  });
});

describe("QueryResultArray", () => {
  it("exposes pagination metadata through the documented meta property", () => {
    const result = new QueryResultArray([{ title: "Hello" }], { total: 42, limit: 10, offset: 20 });

    expect(result.meta).toEqual({ total: 42, limit: 10, offset: 20 });
    expect(result.toJSON()).toEqual({
      data: [{ title: "Hello" }],
      meta: { total: 42, limit: 10, offset: 20 },
    });
  });
});

describe("file metadata normalization", () => {
  it("normalizes canonical file refs into metadata with resolved urls", () => {
    expect(normalizeFileMetadata("abc123.png")).toEqual({
      id: "abc123",
      ext: "png",
      url: "/files/abc123.png",
    });
    expect(normalizeFileMetadata("abc123.png", { filesBasePath: "/custom-files" })).toEqual({
      id: "abc123",
      ext: "png",
      url: "/custom-files/abc123.png",
    });
  });

  it("preserves absolute and relative urls", () => {
    expect(normalizeFileMetadata("https://cdn.example.com/a.png")).toEqual({
      url: "https://cdn.example.com/a.png",
    });
    expect(normalizeFileMetadata("/custom-files/a.png")).toEqual({
      url: "/custom-files/a.png",
    });
  });

  it("hydrates included file props to metadata objects", () => {
    const file = {
      id: "abc123",
      ext: "png",
      status: "ready" as const,
      mediaType: "image",
      size: 100,
      createdAt: 1,
    };
    const items = normalizeIncludedFileMetadata(
      [
        {
          cover: "abc123.png",
          gallery: ["abc123.png", "https://cdn.example.com/a.png"],
          files: [file],
        },
      ],
      { filesBasePath: "/custom-files" },
    );

    const item = items[0] as Record<string, unknown>;
    expect(item.files).toEqual([{ ...file, url: "/custom-files/abc123.png" }]);
    expect(item.cover).toEqual({ ...file, url: "/custom-files/abc123.png" });
    expect(item.gallery).toEqual([
      { ...file, url: "/custom-files/abc123.png" },
      { url: "https://cdn.example.com/a.png" },
    ]);
  });
});

describe("query function resolution", () => {
  it("resolves filter callbacks against item refs", () => {
    expect(resolveQueryFilter((self: any) => `title = ${self.title.path}`)).toBe("title = title");
    expect(resolveQueryFilter((parent: any) => `author = ${parent.name.path}`, 1)).toBe(
      "author = $1.name",
    );
  });

  it("resolves nested with callbacks and filters", () => {
    const resolved = resolveQueryWithFunctions((parent) => ({
      author: {
        collection: "authors",
        filter: (self) => `${self.id.path} = ${parent.authorId.path}`,
        single: true,
        with: {
          organization: {
            collection: "orgs",
            filter: (self) => `${self.id.path} = ${parent.orgId.path}`,
          },
        },
      },
    }));

    expect(resolved).toEqual({
      author: {
        collection: "authors",
        filter: "id = $1.authorId",
        limit: undefined,
        include: undefined,
        single: true,
        with: {
          organization: {
            collection: "orgs",
            filter: "id = $1.orgId",
            limit: undefined,
            include: undefined,
            single: undefined,
            with: undefined,
          },
        },
      },
    });
  });
});
