import { describe, expect, it, beforeEach } from "bun:test";
import type { PageProps } from "@contfu/core";
import { genUid, uuidToBuffer } from "../../util/ids/ids";
import {
  dbQueryPage1,
  dbQueryResult1,
  dbQueryResult2,
  emptyList,
  showcasePageQueryResult,
  showcasePageBlocks,
  showcasePageChildBlocks,
} from "./__fixtures__/notion-query-results";
import { mockClient } from "./__tests__/notion-mock-setup";

// Import after mock setup
const { iteratePages } = await import("./notion-items");

// Helper to get props with correct type
function getProps(item: { props: unknown }): PageProps {
  return item.props as PageProps;
}

// Helper to create a property value
function createProperty<T extends string>(type: T, value: unknown) {
  return {
    id: "prop-id",
    type,
    [type]: value,
  };
}

// Helper to create a rich text item
function richTextItem(text: string) {
  return {
    type: "text",
    text: { content: text, link: null },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
    plain_text: text,
    href: null,
  };
}

describe("notion-items", () => {
  beforeEach(() => {
    mockClient.databases.query.mockClear();
    mockClient.blocks.children.list.mockClear();
  });

  describe("iteratePages()", () => {
    const testOpts = {
      collection: 1,
      ref: Buffer.alloc(16),
      credentials: "",
    };

    it("should convert basic page to item", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      mockClient.blocks.children.list.mockResolvedValue({ results: [], has_more: false });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      expect(items).toHaveLength(2);
      const item = items[0];

      expect(item.collection).toBe(1);
      expect(item.ref).toEqual(uuidToBuffer(dbQueryResult1.id));
      expect(item.id).toEqual(genUid(uuidToBuffer(dbQueryResult1.id)));
      expect(item.createdAt).toBe(new Date(dbQueryResult1.created_time).getTime());
      expect(item.changedAt).toBe(new Date(dbQueryResult1.last_edited_time).getTime());
    });

    it("should extract title property", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      mockClient.blocks.children.list.mockResolvedValue({ results: [], has_more: false });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      expect(getProps(items[0]).Title).toBe("Foo");
      expect(getProps(items[1]).Title).toBe("Bar");
    });

    it("should extract rich_text property", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      mockClient.blocks.children.list.mockResolvedValue({ results: [], has_more: false });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      expect(getProps(items[0]).Description).toBe("A");
      expect(getProps(items[1]).Description).toBe("B");
    });

    it("should extract select property", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      mockClient.blocks.children.list.mockResolvedValue({ results: [], has_more: false });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      expect(getProps(items[0]).Color).toBe("red");
      expect(getProps(items[1]).Color).toBe("blue");
    });

    it("should extract relation property as array of refs", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      mockClient.blocks.children.list.mockResolvedValue({ results: [], has_more: false });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      // Self reference should contain the other item's ref
      expect(getProps(items[0])["Self Reference"]).toEqual([
        genUid(uuidToBuffer(dbQueryResult2.id)).toString("base64url"),
      ]);
    });

    it("should handle empty relation arrays", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      mockClient.blocks.children.list.mockResolvedValue({ results: [], has_more: false });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      // Second item has empty "Other Reference"
      expect(getProps(items[1])["Other Reference"]).toEqual([]);
    });

    it("should include content blocks when present", async () => {
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [dbQueryResult1],
      });
      mockClient.blocks.children.list.mockResolvedValueOnce({
        results: [
          {
            object: "block",
            id: "block-123",
            type: "paragraph",
            has_children: false,
            paragraph: {
              rich_text: [richTextItem("Test content")],
              color: "default",
            },
          },
        ],
        has_more: false,
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      expect(items[0].content).toBeDefined();
      expect(items[0].content).toHaveLength(1);
      expect(items[0].content![0]).toEqual(["p", ["Test content"]]);
    });

    it("should not include content key when blocks are empty", async () => {
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [dbQueryResult1],
      });
      mockClient.blocks.children.list.mockResolvedValueOnce({
        results: [],
        has_more: false,
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      expect(items[0].content).toBeUndefined();
    });
  });

  describe("property parsing", () => {
    const testOpts = {
      collection: 1,
      ref: Buffer.alloc(16),
      credentials: "",
    };

    function createPageWithProperty(propName: string, prop: Record<string, unknown>) {
      return {
        ...dbQueryResult1,
        properties: {
          [propName]: prop,
        },
      };
    }

    beforeEach(() => {
      mockClient.blocks.children.list.mockResolvedValue({ results: [], has_more: false });
    });

    it("should parse number property", async () => {
      const page = createPageWithProperty("Count", createProperty("number", 42));
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Count).toBe(42);
    });

    it("should parse null number property", async () => {
      const page = createPageWithProperty("Count", createProperty("number", null));
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Count).toBeUndefined();
    });

    it("should parse date property", async () => {
      const page = createPageWithProperty(
        "Due",
        createProperty("date", { start: "2024-06-15", end: null, time_zone: null }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Due).toBe(new Date("2024-06-15").getTime());
    });

    it("should parse null date property", async () => {
      const page = createPageWithProperty("Due", createProperty("date", null));
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Due).toBeUndefined();
    });

    it("should parse checkbox property", async () => {
      const page = createPageWithProperty("Done", createProperty("checkbox", true));
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Done).toBe(true);
    });

    it("should parse multi_select property", async () => {
      const page = createPageWithProperty(
        "Tags",
        createProperty("multi_select", [{ name: "Tag1" }, { name: "Tag2" }]),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Tags).toEqual(["Tag1", "Tag2"]);
    });

    it("should parse status property", async () => {
      const page = createPageWithProperty(
        "Status",
        createProperty("status", { name: "In Progress", color: "blue" }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Status).toBe("In Progress");
    });

    it("should parse url property", async () => {
      const page = createPageWithProperty("Link", createProperty("url", "https://example.com"));
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Link).toBe("https://example.com");
    });

    it("should parse email property", async () => {
      const page = createPageWithProperty("Email", createProperty("email", "test@example.com"));
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Email).toBe("test@example.com");
    });

    it("should parse phone_number property", async () => {
      const page = createPageWithProperty("Phone", createProperty("phone_number", "+1234567890"));
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Phone).toBe("+1234567890");
    });

    it("should parse created_time property", async () => {
      const page = createPageWithProperty(
        "Created",
        createProperty("created_time", "2024-01-15T10:30:00.000Z"),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Created).toBe(new Date("2024-01-15T10:30:00.000Z").getTime());
    });

    it("should parse last_edited_time property", async () => {
      const page = createPageWithProperty(
        "Edited",
        createProperty("last_edited_time", "2024-06-20T15:45:00.000Z"),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Edited).toBe(new Date("2024-06-20T15:45:00.000Z").getTime());
    });

    it("should parse files property with file URLs", async () => {
      const page = createPageWithProperty(
        "Attachments",
        createProperty("files", [
          { type: "file", file: { url: "https://s3.amazonaws.com/file1.pdf" } },
          { type: "external", external: { url: "https://example.com/file2.pdf" } },
        ]),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Attachments).toEqual([
        "https://s3.amazonaws.com/file1.pdf",
        "https://example.com/file2.pdf",
      ]);
    });

    it("should parse people property as refs", async () => {
      const page = createPageWithProperty(
        "Assignees",
        createProperty("people", [
          { object: "user", id: "user-uuid-1" },
          { object: "user", id: "user-uuid-2" },
        ]),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Assignees).toHaveLength(2);
      expect((getProps(items[0]).Assignees as string[])[0]).toBe(
        genUid(uuidToBuffer("user-uuid-1")).toString("base64url"),
      );
    });

    it("should parse created_by property as ref", async () => {
      const page = createPageWithProperty(
        "Creator",
        createProperty("created_by", { object: "user", id: "creator-uuid" }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Creator).toBe(
        genUid(uuidToBuffer("creator-uuid")).toString("base64url"),
      );
    });

    it("should parse last_edited_by property as ref", async () => {
      const page = createPageWithProperty(
        "Editor",
        createProperty("last_edited_by", { object: "user", id: "editor-uuid" }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Editor).toBe(
        genUid(uuidToBuffer("editor-uuid")).toString("base64url"),
      );
    });

    it("should parse unique_id property with prefix", async () => {
      const page = createPageWithProperty(
        "ID",
        createProperty("unique_id", { prefix: "TASK", number: 123 }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).ID).toBe("TASK-123");
    });

    it("should parse unique_id property without prefix", async () => {
      const page = createPageWithProperty(
        "ID",
        createProperty("unique_id", { prefix: null, number: 456 }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).ID).toBe(456);
    });

    it("should parse verification property", async () => {
      const page = createPageWithProperty(
        "Verified",
        createProperty("verification", { state: "verified", verified_by: null }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Verified).toBe("verified");
    });

    it("should return null for formula property", async () => {
      const page = createPageWithProperty(
        "Computed",
        createProperty("formula", { type: "number", number: 100 }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Computed).toBeUndefined();
    });

    it("should return null for rollup property", async () => {
      const page = createPageWithProperty(
        "Summary",
        createProperty("rollup", { type: "number", number: 50, function: "sum" }),
      );
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Summary).toBeUndefined();
    });

    it("should return null for button property", async () => {
      const page = createPageWithProperty("Action", createProperty("button", {}));
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [page],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).Action).toBeUndefined();
    });

    it("should extract icon from page (non-emoji)", async () => {
      const pageWithIcon = {
        ...dbQueryResult1,
        icon: {
          type: "external" as const,
          external: { url: "https://example.com/icon.png" },
        },
      };
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [pageWithIcon],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).icon).toBe("https://example.com/icon.png");
    });

    it("should not extract emoji icon", async () => {
      const pageWithEmojiIcon = {
        ...dbQueryResult1,
        icon: { type: "emoji" as const, emoji: "🎉" },
      };
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [pageWithEmojiIcon],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).icon).toBeUndefined();
    });

    it("should extract cover from page", async () => {
      const pageWithCover = {
        ...dbQueryResult1,
        cover: {
          type: "external" as const,
          external: { url: "https://example.com/cover.jpg" },
        },
      };
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [pageWithCover],
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(getProps(items[0]).cover).toBe("https://example.com/cover.jpg");
    });
  });

  describe("showcase page (comprehensive property types)", () => {
    const testOpts = {
      collection: 1,
      ref: Buffer.alloc(16),
      credentials: "",
    };

    beforeEach(() => {
      mockClient.databases.query.mockClear();
      mockClient.blocks.children.list.mockClear();
    });

    it("should parse all property types from showcase page", async () => {
      mockClient.databases.query.mockResolvedValueOnce(showcasePageQueryResult);
      mockClient.blocks.children.list.mockResolvedValue(emptyList);

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      expect(items).toHaveLength(1);

      const props = getProps(items[0]);

      // Title (title property)
      expect(props.Name).toBe("foo");

      // Rich text properties
      expect(props.Description).toBe("Sample page used to demo different block types.");
      expect(props.slug).toBe("foo");

      // URL property
      expect(props["Reference URL"]).toBe("https://www.notion.so");

      // Number property
      expect(props["Estimate (hours)"]).toBe(4);

      // Select property
      expect(props.Priority).toBe("High");

      // Status property
      expect(props.Status).toBe("In progress");

      // Multi-select property
      expect(props.Tags).toEqual(["Demo", "Frontend", "Idea"]);

      // Checkbox property
      expect(props.Completed).toBe(false);

      // Date property
      expect(props["Due date"]).toBe(new Date("2026-01-18").getTime());

      // Created time property
      expect(props["Created by"]).toBeDefined();
      expect(typeof props["Created by"]).toBe("string");

      // Last edited time property
      expect(props["Last edited time"]).toBe(new Date("2026-01-11T15:34:00.000Z").getTime());

      // People property
      expect(props.Owner).toBeDefined();
      expect(Array.isArray(props.Owner)).toBe(true);
      expect((props.Owner as string[]).length).toBe(1);

      // Files property (empty in showcase)
      expect(props.Attachments).toEqual([]);

      // Cover image
      expect(props.cover).toBe(
        "https://www.notion.so/images/page-cover/met_william_morris_1878.jpg",
      );

      // Location property (place type) - not handled, should be undefined
      expect(props.Location).toBeUndefined();
    });

    it("should have correct metadata from showcase page", async () => {
      mockClient.databases.query.mockResolvedValueOnce(showcasePageQueryResult);
      mockClient.blocks.children.list.mockResolvedValue(emptyList);

      const items = await Array.fromAsync(iteratePages(testOpts, {}));
      const item = items[0];

      expect(item.collection).toBe(1);
      expect(item.ref).toEqual(uuidToBuffer("2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17"));
      expect(item.id).toEqual(genUid(uuidToBuffer("2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17")));
      expect(item.createdAt).toBe(new Date("2026-01-11T13:04:00.000Z").getTime());
      expect(item.changedAt).toBe(new Date("2026-01-11T15:34:00.000Z").getTime());
    });

    it("should include content blocks when present", async () => {
      mockClient.databases.query.mockResolvedValueOnce(showcasePageQueryResult);
      mockClient.blocks.children.list.mockImplementation((args: { block_id: string }) => {
        const childBlocks = showcasePageChildBlocks[args.block_id];
        if (childBlocks) {
          return Promise.resolve(childBlocks);
        }
        return Promise.resolve(showcasePageBlocks);
      });

      const items = await Array.fromAsync(iteratePages(testOpts, {}));

      expect(items[0].content).toBeDefined();
      expect(items[0].content!.length).toBeGreaterThan(0);
    });
  });
});
