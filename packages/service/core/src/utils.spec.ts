import { describe, expect, it } from "bun:test";
import { toCamelCase } from "./utils";

describe("toCamelCase", () => {
  it("converts space-separated words", () => {
    expect(toCamelCase("Blog Posts")).toBe("blogPosts");
  });

  it("converts hyphen-separated words", () => {
    expect(toCamelCase("blog-posts")).toBe("blogPosts");
  });

  it("converts underscore-separated words", () => {
    expect(toCamelCase("blog_posts")).toBe("blogPosts");
  });

  it("lowercases a single word", () => {
    expect(toCamelCase("Articles")).toBe("articles");
  });

  it("handles already-camelCase input", () => {
    expect(toCamelCase("blogPosts")).toBe("blogPosts");
  });

  it("trims leading and trailing whitespace", () => {
    expect(toCamelCase("  Blog Posts  ")).toBe("blogPosts");
  });

  it("handles multiple consecutive separators", () => {
    expect(toCamelCase("blog--posts")).toBe("blogPosts");
  });

  it("preserves digits", () => {
    expect(toCamelCase("user 2 collection")).toBe("user2Collection");
  });

  it("strips trailing non-alphanumeric characters", () => {
    expect(toCamelCase("Estimate (hours)")).toBe("estimateHours");
  });
});
