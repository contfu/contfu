import { isH1, isH2, isH3 } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  emptyList,
  showcasePageBlocks,
  showcasePageChildBlocks,
  tableContent,
} from "./__fixtures__/notion-query-results";
import { mockClient } from "./__tests__/notion-mock-setup";

// Import after mock setup
const { parseBlock, getContentBlocks } = await import("./notion-blocks");

// Helper to create a rich text item
function richText(
  text: string,
  opts: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    href?: string;
  } = {},
) {
  return {
    type: "text" as const,
    text: { content: text, link: opts.href ? { url: opts.href } : null },
    annotations: {
      bold: opts.bold ?? false,
      italic: opts.italic ?? false,
      strikethrough: false,
      underline: false,
      code: opts.code ?? false,
      color: "default" as const,
    },
    plain_text: text,
    href: opts.href ?? null,
  };
}

// Helper to create a block object
function createBlock<T extends BlockObjectResponse["type"]>(
  type: T,
  content: Record<string, unknown>,
  opts: { hasChildren?: boolean; id?: string } = {},
): BlockObjectResponse {
  return {
    object: "block",
    id: opts.id ?? "block-id-123",
    parent: { type: "page_id", page_id: "page-123" },
    created_time: "2024-01-01T00:00:00.000Z",
    last_edited_time: "2024-01-01T00:00:00.000Z",
    created_by: { object: "user", id: "user-123" },
    last_edited_by: { object: "user", id: "user-123" },
    has_children: opts.hasChildren ?? false,
    archived: false,
    in_trash: false,
    type,
    [type]: content,
  } as BlockObjectResponse;
}

describe("notion-blocks", () => {
  beforeEach(() => {
    mockClient.blocks.children.list.mockClear();
  });

  describe("parseBlock()", () => {
    describe("paragraph blocks", () => {
      it("should parse paragraph with plain text", () => {
        const block = createBlock("paragraph", {
          rich_text: [richText("Hello world")],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["p", ["Hello world"]]);
      });

      it("should return null for empty paragraphs", () => {
        const block = createBlock("paragraph", {
          rich_text: [],
          color: "default",
        });

        expect(parseBlock(block)).toBeNull();
      });

      it("should handle paragraph with multiple text segments", () => {
        const block = createBlock("paragraph", {
          rich_text: [richText("First "), richText("second"), richText(" third")],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["p", ["First", "second", "third"]]);
      });
    });

    describe("heading blocks", () => {
      it("should parse heading 1", () => {
        const block = createBlock("heading_1", {
          rich_text: [richText("Main Title")],
          color: "default",
          is_toggleable: false,
        });

        expect(parseBlock(block)).toEqual(["1", ["Main Title"]]);
      });

      it("should parse heading 2", () => {
        const block = createBlock("heading_2", {
          rich_text: [richText("Section Title")],
          color: "default",
          is_toggleable: false,
        });

        expect(parseBlock(block)).toEqual(["2", ["Section Title"]]);
      });

      it("should parse heading 3", () => {
        const block = createBlock("heading_3", {
          rich_text: [richText("Sub Section")],
          color: "default",
          is_toggleable: false,
        });

        expect(parseBlock(block)).toEqual(["3", ["Sub Section"]]);
      });

      it("should return null for empty headings", () => {
        const block = createBlock("heading_1", {
          rich_text: [],
          color: "default",
        });

        expect(parseBlock(block)).toBeNull();
      });

      it("should return null for headings with children (toggleable)", () => {
        const block = createBlock(
          "heading_1",
          {
            rich_text: [richText("Toggle Heading")],
            color: "default",
            is_toggleable: true,
          },
          { hasChildren: true },
        );

        expect(parseBlock(block)).toBeNull();
      });
    });

    describe("quote blocks", () => {
      it("should parse quote block", () => {
        const block = createBlock("quote", {
          rich_text: [richText("A wise quote")],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["q", ["A wise quote"]]);
      });

      it("should handle empty quote (still returns block)", () => {
        const block = createBlock("quote", {
          rich_text: [],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["q", []]);
      });
    });

    describe("code blocks", () => {
      it("should parse code block with language", () => {
        const block = createBlock("code", {
          rich_text: [richText("const x = 1;")],
          language: "javascript",
          caption: [],
        });

        expect(parseBlock(block)).toEqual(["c", "javascript", "const x = 1;"]);
      });

      it("should handle code block with backslashes", () => {
        const block = createBlock("code", {
          rich_text: [richText("path\\to\\file")],
          language: "plain text",
          caption: [],
        });

        expect(parseBlock(block)).toEqual(["c", "plain text", "pathtofile"]);
      });

      it("should parse code block with different languages", () => {
        const pythonBlock = createBlock("code", {
          rich_text: [richText("print('hello')")],
          language: "python",
          caption: [],
        });
        expect(parseBlock(pythonBlock)).toEqual(["c", "python", "print('hello')"]);

        const typescriptBlock = createBlock("code", {
          rich_text: [richText("const x: number = 1")],
          language: "typescript",
          caption: [],
        });
        expect(parseBlock(typescriptBlock)).toEqual(["c", "typescript", "const x: number = 1"]);
      });
    });

    describe("list blocks", () => {
      it("should parse bulleted list item", () => {
        const block = createBlock("bulleted_list_item", {
          rich_text: [richText("Bullet point")],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["u", ["Bullet point"]]);
      });

      it("should parse numbered list item", () => {
        const block = createBlock("numbered_list_item", {
          rich_text: [richText("First item")],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["o", ["First item"]]);
      });
    });

    describe("image blocks", () => {
      it("should parse image with file URL", () => {
        const block = createBlock("image", {
          type: "file",
          file: {
            url: "https://s3.amazonaws.com/image.png",
            expiry_time: "2024-01-01",
          },
          caption: [],
        });

        expect(parseBlock(block)).toEqual(["i", "https://s3.amazonaws.com/image.png", "", []]);
      });

      it("should parse image with external URL", () => {
        const block = createBlock("image", {
          type: "external",
          external: { url: "https://example.com/image.jpg" },
          caption: [],
        });

        expect(parseBlock(block)).toEqual(["i", "https://example.com/image.jpg", "", []]);
      });

      it("should parse image with caption", () => {
        const block = createBlock("image", {
          type: "external",
          external: { url: "https://example.com/image.jpg" },
          caption: [richText("Image description")],
        });

        expect(parseBlock(block)).toEqual([
          "i",
          "https://example.com/image.jpg",
          "Image description",
          [],
        ]);
      });
    });

    describe("link_to_page blocks", () => {
      it("should parse link to page", () => {
        const block = createBlock("link_to_page", {
          type: "page_id",
          page_id: "target-page-uuid",
        });

        expect(parseBlock(block)).toEqual(["p", ["a", "", "target-page-uuid"]]);
      });

      it("should return null for non-page links", () => {
        const block = createBlock("link_to_page", {
          type: "database_id",
          database_id: "db-uuid",
        });

        expect(parseBlock(block)).toBeNull();
      });
    });

    describe("table blocks", () => {
      it("should parse table block with column header", () => {
        const block = createBlock("table", {
          table_width: 3,
          has_column_header: true,
          has_row_header: false,
        });

        expect(parseBlock(block)).toEqual(["t", true, []]);
      });

      it("should parse table block without column header", () => {
        const block = createBlock("table", {
          table_width: 2,
          has_column_header: false,
          has_row_header: false,
        });

        expect(parseBlock(block)).toEqual(["t", false, []]);
      });
    });

    describe("unsupported blocks", () => {
      it("should return null for unsupported block types", () => {
        const dividerBlock = createBlock("divider" as "paragraph", {});
        expect(parseBlock(dividerBlock)).toBeNull();

        const tocBlock = createBlock("table_of_contents" as "paragraph", {
          color: "default",
        });
        expect(parseBlock(tocBlock)).toBeNull();

        const bookmarkBlock = createBlock("bookmark" as "paragraph", {
          url: "https://example.com",
          caption: [],
        });
        expect(parseBlock(bookmarkBlock)).toBeNull();
      });
    });

    describe("rich text formatting", () => {
      it("should handle bold text", () => {
        const block = createBlock("paragraph", {
          rich_text: [richText("bold text", { bold: true })],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["p", [["b", "bold text"]]]);
      });

      it("should handle italic text", () => {
        const block = createBlock("paragraph", {
          rich_text: [richText("italic text", { italic: true })],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["p", [["i", "italic text"]]]);
      });

      it("should handle code text", () => {
        const block = createBlock("paragraph", {
          rich_text: [richText("inline code", { code: true })],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["p", [["c", "inline code"]]]);
      });

      it("should handle links", () => {
        const block = createBlock("paragraph", {
          rich_text: [richText("click here", { href: "https://example.com" })],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["p", [["a", "click here", "https://example.com"]]]);
      });

      it("should handle mixed formatting", () => {
        const block = createBlock("paragraph", {
          rich_text: [
            richText("Normal "),
            richText("bold", { bold: true }),
            richText(" and "),
            richText("italic", { italic: true }),
          ],
          color: "default",
        });

        expect(parseBlock(block)).toEqual(["p", ["Normal", ["b", "bold"], "and", ["i", "italic"]]]);
      });

      it("should prioritize link over other formatting", () => {
        const block = createBlock("paragraph", {
          rich_text: [
            richText("linked text", {
              bold: true,
              href: "https://example.com",
            }),
          ],
          color: "default",
        });

        // Link should take precedence
        expect(parseBlock(block)).toEqual(["p", [["a", "linked text", "https://example.com"]]]);
      });
    });
  });

  describe("getContentBlocks()", () => {
    const testKey = "test-api-key";

    it("should fetch and parse blocks from a page", async () => {
      mockClient.blocks.children.list.mockResolvedValueOnce(emptyList);

      const blocks = await getContentBlocks(testKey, "page-123");

      expect(blocks).toEqual([]);
      expect(mockClient.blocks.children.list).toHaveBeenCalled();
    });

    it("should merge consecutive bulleted list items", async () => {
      mockClient.blocks.children.list.mockResolvedValueOnce({
        ...emptyList,
        results: [
          createBlock("bulleted_list_item", {
            rich_text: [richText("Item 1")],
            color: "default",
          }),
          createBlock("bulleted_list_item", {
            rich_text: [richText("Item 2")],
            color: "default",
          }),
        ],
      });

      const blocks = await getContentBlocks(testKey, "page-123");

      // Should be merged into single list
      expect(blocks).toEqual([["u", ["Item 1"], ["Item 2"]]]);
    });

    it("should merge consecutive numbered list items", async () => {
      mockClient.blocks.children.list.mockResolvedValueOnce({
        ...emptyList,
        results: [
          createBlock("numbered_list_item", {
            rich_text: [richText("First")],
            color: "default",
          }),
          createBlock("numbered_list_item", {
            rich_text: [richText("Second")],
            color: "default",
          }),
        ],
      });

      const blocks = await getContentBlocks(testKey, "page-123");

      expect(blocks).toEqual([["o", ["First"], ["Second"]]]);
    });

    it("should preserve list item boundaries with formatted content", async () => {
      mockClient.blocks.children.list.mockResolvedValueOnce({
        ...emptyList,
        results: [
          createBlock("bulleted_list_item", {
            rich_text: [richText("Plain item")],
            color: "default",
          }),
          createBlock("bulleted_list_item", {
            rich_text: [
              richText("Bold", { bold: true }),
              richText(" and "),
              richText("link", { href: "https://example.com" }),
            ],
            color: "default",
          }),
        ],
      });

      const blocks = await getContentBlocks(testKey, "page-123");

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual([
        "u",
        ["Plain item"],
        [["b", "Bold"], "and", ["a", "link", "https://example.com"]],
      ]);
    });

    it("should not merge different list types", async () => {
      mockClient.blocks.children.list.mockResolvedValueOnce({
        ...emptyList,
        results: [
          createBlock("bulleted_list_item", {
            rich_text: [richText("Bullet")],
            color: "default",
          }),
          createBlock("numbered_list_item", {
            rich_text: [richText("Number")],
            color: "default",
          }),
        ],
      });

      const blocks = await getContentBlocks(testKey, "page-123");

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual(["u", ["Bullet"]]);
      expect(blocks[1]).toEqual(["o", ["Number"]]);
    });

    it("should fetch nested list children", async () => {
      const parentListItem = createBlock(
        "bulleted_list_item",
        {
          rich_text: [richText("Parent")],
          color: "default",
        },
        { hasChildren: true, id: "parent-list-id" },
      );

      mockClient.blocks.children.list
        .mockResolvedValueOnce({
          ...emptyList,
          results: [parentListItem],
        })
        .mockResolvedValueOnce({
          ...emptyList,
          results: [
            createBlock("bulleted_list_item", {
              rich_text: [richText("Child")],
              color: "default",
            }),
          ],
        });

      const blocks = await getContentBlocks(testKey, "page-123");

      expect(blocks).toHaveLength(1);
      // Parent list with nested child list
      expect(blocks[0][0]).toBe("u");
      expect(blocks[0]).toHaveLength(3); // ["u", ["Parent"], [nested child list]]
    });

    it("should fetch table rows for tables with children", async () => {
      const tableBlock = createBlock(
        "table",
        {
          table_width: 2,
          has_column_header: true,
          has_row_header: false,
        },
        { hasChildren: true, id: "table-id" },
      );

      mockClient.blocks.children.list
        .mockResolvedValueOnce({
          ...emptyList,
          results: [tableBlock],
        })
        .mockResolvedValueOnce(tableContent);

      const blocks = await getContentBlocks(testKey, "page-123");

      expect(blocks).toHaveLength(1);
      expect(blocks[0][0]).toBe("t");
      expect(blocks[0][1]).toBe(true); // has_column_header
      expect(blocks[0][2]).toHaveLength(3); // 3 rows from tableContent
    });

    it("should fetch nested content for quotes with children", async () => {
      const quoteBlock = createBlock(
        "quote",
        {
          rich_text: [richText("Quote text")],
          color: "default",
        },
        { hasChildren: true, id: "quote-id" },
      );

      mockClient.blocks.children.list
        .mockResolvedValueOnce({
          ...emptyList,
          results: [quoteBlock],
        })
        .mockResolvedValueOnce({
          ...emptyList,
          results: [
            createBlock("paragraph", {
              rich_text: [richText("Nested paragraph")],
              color: "default",
            }),
          ],
        });

      const blocks = await getContentBlocks(testKey, "page-123");

      expect(blocks).toHaveLength(1);
      expect(blocks[0][0]).toBe("q");
      // Quote should contain nested content
      expect(blocks[0][1]).toContain("Quote text");
    });

    it("should skip null blocks (empty paragraphs)", async () => {
      mockClient.blocks.children.list.mockResolvedValueOnce({
        ...emptyList,
        results: [
          createBlock("paragraph", { rich_text: [], color: "default" }),
          createBlock("paragraph", {
            rich_text: [richText("Valid content")],
            color: "default",
          }),
        ],
      });

      const blocks = await getContentBlocks(testKey, "page-123");

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual(["p", ["Valid content"]]);
    });
  });

  describe("showcase page blocks (comprehensive block types)", () => {
    const testKey = "test-api-key";
    const PAGE_ID = "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17";

    beforeEach(() => {
      mockClient.blocks.children.list.mockClear();
    });

    it("should parse all block types from showcase page", async () => {
      mockClient.blocks.children.list.mockImplementation((args: { block_id: string }) => {
        const childBlocks = showcasePageChildBlocks[args.block_id];
        if (childBlocks) {
          return Promise.resolve(childBlocks);
        }
        if (args.block_id === PAGE_ID) {
          return Promise.resolve(showcasePageBlocks);
        }
        return Promise.resolve(emptyList);
      });

      const blocks = await getContentBlocks(testKey, PAGE_ID);

      // Should have parsed blocks (some may be skipped as unsupported)
      expect(blocks.length).toBeGreaterThan(0);

      // Check for specific block types
      const blockTypes = blocks.map((b) => b[0]);

      // Should have headings
      expect(blockTypes).toContain("1"); // heading_1
      expect(blockTypes).toContain("2"); // heading_2
      expect(blockTypes).toContain("3"); // heading_3

      // Should have paragraph
      expect(blockTypes).toContain("p");

      // Should have quote
      expect(blockTypes).toContain("q");

      // Should have lists (merged)
      expect(blockTypes).toContain("u"); // bulleted list
      expect(blockTypes).toContain("o"); // numbered list

      // Should have code block
      expect(blockTypes).toContain("c");

      // Should have table
      expect(blockTypes).toContain("t");
    });

    it("should correctly parse paragraph with rich text formatting", async () => {
      mockClient.blocks.children.list.mockImplementation((args: { block_id: string }) => {
        if (args.block_id === PAGE_ID) {
          return Promise.resolve(showcasePageBlocks);
        }
        return Promise.resolve(showcasePageChildBlocks[args.block_id] || emptyList);
      });

      const blocks = await getContentBlocks(testKey, PAGE_ID);

      // Find a paragraph with formatting
      const formattedParagraph = blocks.find(
        (b) =>
          b[0] === "p" &&
          Array.isArray(b[1]) &&
          b[1].some((item) => Array.isArray(item) && item[0] === "b"),
      );

      expect(formattedParagraph).toBeDefined();
    });

    it("should correctly parse headings", async () => {
      mockClient.blocks.children.list.mockImplementation((args: { block_id: string }) => {
        if (args.block_id === PAGE_ID) {
          return Promise.resolve(showcasePageBlocks);
        }
        return Promise.resolve(showcasePageChildBlocks[args.block_id] || emptyList);
      });

      const blocks = await getContentBlocks(testKey, PAGE_ID);

      // Find h1 with "Heading 1"
      expect(blocks.some((b) => isH1(b) && b[1].includes("Heading 1"))).toBe(true);

      // Find h2 with "Heading 2"
      expect(blocks.some((b) => isH2(b) && b[1].includes("Heading 2"))).toBe(true);

      // Find h3 with "Heading 3"
      expect(blocks.some((b) => isH3(b) && b[1].includes("Heading 3"))).toBe(true);
    });

    it("should correctly parse code block with language", async () => {
      mockClient.blocks.children.list.mockImplementation((args: { block_id: string }) => {
        if (args.block_id === PAGE_ID) {
          return Promise.resolve(showcasePageBlocks);
        }
        return Promise.resolve(showcasePageChildBlocks[args.block_id] || emptyList);
      });

      const blocks = await getContentBlocks(testKey, PAGE_ID);

      // Find code block
      const codeBlock = blocks.find((b) => b[0] === "c");
      expect(codeBlock).toBeDefined();
      expect(codeBlock![1]).toBeDefined(); // language
      expect(codeBlock![2]).toBeDefined(); // code content
    });

    it("should merge consecutive list items", async () => {
      mockClient.blocks.children.list.mockImplementation((args: { block_id: string }) => {
        if (args.block_id === PAGE_ID) {
          return Promise.resolve(showcasePageBlocks);
        }
        return Promise.resolve(showcasePageChildBlocks[args.block_id] || emptyList);
      });

      const blocks = await getContentBlocks(testKey, PAGE_ID);

      // Find bulleted list - should be merged into single list with multiple items
      const bulletedLists = blocks.filter((b) => b[0] === "u");
      expect(bulletedLists.length).toBeGreaterThan(0);

      // First bulleted list should have multiple items (length > 2 means more than just ["u", [first item]])
      const firstBulletedList = bulletedLists[0];
      expect(firstBulletedList.length).toBeGreaterThan(2);
      expect(Array.isArray(firstBulletedList[1])).toBe(true);
      expect(Array.isArray(firstBulletedList[2])).toBe(true);
    });

    it("should correctly parse quote blocks", async () => {
      mockClient.blocks.children.list.mockImplementation((args: { block_id: string }) => {
        if (args.block_id === PAGE_ID) {
          return Promise.resolve(showcasePageBlocks);
        }
        return Promise.resolve(showcasePageChildBlocks[args.block_id] || emptyList);
      });

      const blocks = await getContentBlocks(testKey, PAGE_ID);

      // Find quote block
      const quoteBlock = blocks.find((b) => b[0] === "q");
      expect(quoteBlock).toBeDefined();
      expect(quoteBlock![1]).toBeDefined(); // quote content
    });

    it("should skip unsupported block types gracefully", async () => {
      mockClient.blocks.children.list.mockImplementation((args: { block_id: string }) => {
        if (args.block_id === PAGE_ID) {
          return Promise.resolve(showcasePageBlocks);
        }
        return Promise.resolve(showcasePageChildBlocks[args.block_id] || emptyList);
      });

      // Should not throw error despite having divider, table_of_contents, and other unsupported types
      const blocks = await getContentBlocks(testKey, PAGE_ID);
      expect(blocks).toBeDefined();

      // Dividers and table_of_contents should be skipped (not in output)
      const blockTypes = blocks.map((b) => b[0]);
      expect(blockTypes).not.toContain("divider");
      expect(blockTypes).not.toContain("table_of_contents");
    });
  });
});
