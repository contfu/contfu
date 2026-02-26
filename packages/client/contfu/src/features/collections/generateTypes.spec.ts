import { PropertyType } from "@contfu/core";
import { describe, expect, it } from "bun:test";
import { generateTypes } from "./generateTypes";

describe("generateTypes", () => {
  it("generates types for a single collection", () => {
    const result = generateTypes({
      blogPosts: {
        title: PropertyType.STRING,
        published: PropertyType.BOOLEAN,
        views: PropertyType.NUMBER,
      },
    });
    expect(result).toMatchSnapshot();
  });

  it("generates types for multiple collections", () => {
    const result = generateTypes({
      blogPosts: {
        title: PropertyType.STRING,
        tags: PropertyType.STRINGS,
      },
      authors: {
        name: PropertyType.STRING,
        featured: PropertyType.BOOLEAN,
      },
    });
    expect(result).toMatchSnapshot();
  });

  it("maps all property types correctly", () => {
    const result = generateTypes({
      everything: {
        str: PropertyType.STRING,
        strs: PropertyType.STRINGS,
        num: PropertyType.NUMBER,
        nums: PropertyType.NUMBERS,
        bool: PropertyType.BOOLEAN,
        ref: PropertyType.REF,
        refs: PropertyType.REFS,
        file: PropertyType.FILE,
        files: PropertyType.FILES,
        date: PropertyType.DATE,
      },
    });
    expect(result).toMatchSnapshot();
  });

  it("does not generate CollectionMap", () => {
    const result = generateTypes({
      articles: { title: PropertyType.STRING },
      tags: { label: PropertyType.STRING },
    });
    expect(result).not.toContain("CollectionMap");
    expect(result).toContain("ArticlesProps");
    expect(result).toContain("TagsProps");
  });

  it("capitalises collection name for the type name", () => {
    const result = generateTypes({ blogPosts: { title: PropertyType.STRING } });
    expect(result).toContain("BlogPostsProps");
  });
});
