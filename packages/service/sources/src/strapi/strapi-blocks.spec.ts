import { describe, expect, it } from "bun:test";
import { convertStrapiBlocks, isStrapiBlocks } from "./strapi-blocks";
import type { StrapiBlock } from "./strapi";

describe("strapi-blocks", () => {
  describe("convertStrapiBlocks()", () => {
    it("should return empty array for undefined blocks", () => {
      expect(convertStrapiBlocks(undefined)).toEqual([]);
    });

    it("should return empty array for empty blocks", () => {
      expect(convertStrapiBlocks([])).toEqual([]);
    });

    it("should convert paragraph blocks", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "paragraph",
          children: [{ type: "text", text: "Hello world" }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["p", ["Hello world"]]]);
    });

    it("should skip empty paragraphs", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "paragraph",
          children: [{ type: "text", text: "   " }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([]);
    });

    it("should convert heading blocks with different levels", () => {
      const blocks: StrapiBlock[] = [
        { type: "heading", level: 1, children: [{ type: "text", text: "H1" }] },
        { type: "heading", level: 2, children: [{ type: "text", text: "H2" }] },
        { type: "heading", level: 3, children: [{ type: "text", text: "H3" }] },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([
        ["1", ["H1"]],
        ["2", ["H2"]],
        ["3", ["H3"]],
      ]);
    });

    it("should default to level 1 for headings without level", () => {
      const blocks: StrapiBlock[] = [
        { type: "heading", children: [{ type: "text", text: "Default" }] },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["1", ["Default"]]]);
    });

    it("should convert quote blocks", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "quote",
          children: [{ type: "text", text: "A wise quote" }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["q", ["A wise quote"]]]);
    });

    it("should convert code blocks", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "code",
          language: "javascript",
          children: [{ type: "text", text: "const x = 1;" }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["c", "javascript", "const x = 1;"]]);
    });

    it("should handle code blocks without language", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "code",
          children: [{ type: "text", text: "plain code" }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["c", "", "plain code"]]);
    });

    it("should convert image blocks with relative URL", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "image",
          image: {
            id: 1,
            documentId: "img1",
            name: "test.png",
            url: "/uploads/test.png",
            mime: "image/png",
            alternativeText: "Test image",
          },
        },
      ];

      expect(convertStrapiBlocks(blocks, "https://strapi.example.com")).toEqual([
        ["i", "https://strapi.example.com/uploads/test.png", "Test image", []],
      ]);
    });

    it("should convert image blocks with absolute URL", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "image",
          image: {
            id: 1,
            documentId: "img1",
            name: "test.png",
            url: "https://cdn.example.com/test.png",
            mime: "image/png",
          },
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([
        ["i", "https://cdn.example.com/test.png", "", []],
      ]);
    });

    it("should skip image blocks without URL", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "image",
          image: {
            id: 1,
            documentId: "img1",
            name: "test.png",
            mime: "image/png",
          } as any,
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([]);
    });

    it("should convert unordered list blocks and merge consecutive items", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "list",
          format: "unordered",
          children: [{ type: "list-item", children: [{ type: "text", text: "Item 1" }] }],
        },
        {
          type: "list",
          format: "unordered",
          children: [{ type: "list-item", children: [{ type: "text", text: "Item 2" }] }],
        },
      ];

      expect(convertStrapiBlocks(blocks) as unknown).toEqual([["u", ["Item 1"], ["Item 2"]]]);
    });

    it("should convert ordered list blocks and merge consecutive items", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "list",
          format: "ordered",
          children: [{ type: "list-item", children: [{ type: "text", text: "First" }] }],
        },
        {
          type: "list",
          format: "ordered",
          children: [{ type: "list-item", children: [{ type: "text", text: "Second" }] }],
        },
      ];

      expect(convertStrapiBlocks(blocks) as unknown).toEqual([["o", ["First"], ["Second"]]]);
    });

    it("should not merge different list types", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "list",
          format: "unordered",
          children: [{ type: "list-item", children: [{ type: "text", text: "Bullet" }] }],
        },
        {
          type: "list",
          format: "ordered",
          children: [{ type: "list-item", children: [{ type: "text", text: "Number" }] }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([
        ["u", ["Bullet"]],
        ["o", ["Number"]],
      ]);
    });

    it("should convert bold text", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "paragraph",
          children: [{ type: "text", text: "bold text", bold: true }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["p", [["b", "bold text"]]]]);
    });

    it("should convert italic text", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "paragraph",
          children: [{ type: "text", text: "italic text", italic: true }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["p", [["i", "italic text"]]]]);
    });

    it("should convert code inline text", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "paragraph",
          children: [{ type: "text", text: "code", code: true }],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["p", [["c", "code"]]]]);
    });

    it("should convert links", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: "https://example.com",
              children: [{ type: "text", text: "click here" }],
            },
          ],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([
        ["p", [["a", "click here", "https://example.com"]]],
      ]);
    });

    it("should handle mixed inline formatting", () => {
      const blocks: StrapiBlock[] = [
        {
          type: "paragraph",
          children: [
            { type: "text", text: "Normal " },
            { type: "text", text: "bold", bold: true },
            { type: "text", text: " and " },
            { type: "text", text: "italic", italic: true },
          ],
        },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([
        ["p", ["Normal", ["b", "bold"], "and", ["i", "italic"]]],
      ]);
    });

    it("should skip unknown block types", () => {
      const blocks: StrapiBlock[] = [
        { type: "unknown-type" as any, children: [] },
        { type: "paragraph", children: [{ type: "text", text: "Valid" }] },
      ];

      expect(convertStrapiBlocks(blocks)).toEqual([["p", ["Valid"]]]);
    });
  });

  describe("isStrapiBlocks()", () => {
    it("should return false for non-arrays", () => {
      expect(isStrapiBlocks("string")).toBe(false);
      expect(isStrapiBlocks(123)).toBe(false);
      expect(isStrapiBlocks(null)).toBe(false);
      expect(isStrapiBlocks(undefined)).toBe(false);
      expect(isStrapiBlocks({})).toBe(false);
    });

    it("should return false for empty arrays", () => {
      expect(isStrapiBlocks([])).toBe(false);
    });

    it("should return false for arrays without type property", () => {
      expect(isStrapiBlocks([{ text: "hello" }])).toBe(false);
      expect(isStrapiBlocks([{ type: 123 }])).toBe(false);
    });

    it("should return true for valid blocks array", () => {
      expect(isStrapiBlocks([{ type: "paragraph", children: [] }])).toBe(true);
      expect(isStrapiBlocks([{ type: "heading", level: 1 }])).toBe(true);
    });
  });
});
