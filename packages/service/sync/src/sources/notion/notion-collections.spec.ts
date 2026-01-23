import { describe, expect, it, beforeEach } from "bun:test";
import { PropertyType } from "@contfu/core";
import { mockClient } from "./__tests__/notion-mock-setup";

// Import after mock setup
const { getCollectionSchema } = await import("./notion-collections");

// Helper to create a database property schema
function createDbProperty<T extends string>(type: T, extra: Record<string, unknown> = {}) {
  return {
    id: "prop-id",
    type,
    name: "Property Name",
    [type]: extra,
  };
}

describe("notion-collections", () => {
  beforeEach(() => {
    mockClient.databases.retrieve.mockClear();
  });

  describe("getCollectionSchema()", () => {
    const testKey = Buffer.from("test-api-key", "utf8");
    const testId = Buffer.from("database-id-123", "utf8");

    it("should include default cover and icon properties", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {},
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.cover).toBe(PropertyType.FILE | PropertyType.NULL);
      expect(schema.icon).toBe(PropertyType.FILE | PropertyType.NULL);
    });

    it("should map title property to STRING | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Title: createDbProperty("title"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Title).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map rich_text property to STRING | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Description: createDbProperty("rich_text"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Description).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map url property to STRING | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Link: createDbProperty("url"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Link).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map email property to STRING | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Email: createDbProperty("email"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Email).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map phone_number property to STRING | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Phone: createDbProperty("phone_number"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Phone).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map status property to STRING | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Status: createDbProperty("status", {
            options: [{ name: "Active" }, { name: "Done" }],
          }),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Status).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map select property to STRING | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Category: createDbProperty("select", {
            options: [{ name: "A" }, { name: "B" }],
          }),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Category).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map number property to NUMBER | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Count: createDbProperty("number", { format: "number" }),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Count).toBe(PropertyType.NUMBER | PropertyType.NULL);
    });

    it("should map date property to DATE | NULL", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Due: createDbProperty("date"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Due).toBe(PropertyType.DATE | PropertyType.NULL);
    });

    it("should map checkbox property to BOOLEAN (without NULL)", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Done: createDbProperty("checkbox"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Done).toBe(PropertyType.BOOLEAN);
    });

    it("should map files property to FILES", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Attachments: createDbProperty("files"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Attachments).toBe(PropertyType.FILES);
    });

    it("should map created_time property to DATE (without NULL)", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Created: createDbProperty("created_time"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Created).toBe(PropertyType.DATE);
    });

    it("should map last_edited_time property to DATE (without NULL)", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Modified: createDbProperty("last_edited_time"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Modified).toBe(PropertyType.DATE);
    });

    it("should map relation property to REFS", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Related: createDbProperty("relation", {
            database_id: "other-db-id",
            type: "dual_property",
          }),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Related).toBe(PropertyType.REFS);
    });

    it("should map people property to REFS", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Assignees: createDbProperty("people"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Assignees).toBe(PropertyType.REFS);
    });

    it("should map created_by property to REF", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Creator: createDbProperty("created_by"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Creator).toBe(PropertyType.REF);
    });

    it("should map last_edited_by property to REF", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Editor: createDbProperty("last_edited_by"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Editor).toBe(PropertyType.REF);
    });

    it("should skip unsupported property types", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Formula: createDbProperty("formula", { expression: "1+1" }),
          Rollup: createDbProperty("rollup", { function: "sum" }),
          Button: createDbProperty("button"),
          MultiSelect: createDbProperty("multi_select", { options: [] }),
          UniqueId: createDbProperty("unique_id", { prefix: "ID" }),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.Formula).toBeUndefined();
      expect(schema.Rollup).toBeUndefined();
      expect(schema.Button).toBeUndefined();
      expect(schema.MultiSelect).toBeUndefined();
      expect(schema.UniqueId).toBeUndefined();
    });

    it("should handle database with multiple properties", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {
          Title: createDbProperty("title"),
          Description: createDbProperty("rich_text"),
          Status: createDbProperty("status"),
          Priority: createDbProperty("select"),
          Count: createDbProperty("number"),
          DueDate: createDbProperty("date"),
          Done: createDbProperty("checkbox"),
          Files: createDbProperty("files"),
          CreatedAt: createDbProperty("created_time"),
          UpdatedAt: createDbProperty("last_edited_time"),
          Related: createDbProperty("relation"),
          Assignees: createDbProperty("people"),
          Creator: createDbProperty("created_by"),
        },
      });

      const schema = await getCollectionSchema(testKey, testId);

      // Verify all expected properties are present
      expect(schema.Title).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.Description).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.Status).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.Priority).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.Count).toBe(PropertyType.NUMBER | PropertyType.NULL);
      expect(schema.DueDate).toBe(PropertyType.DATE | PropertyType.NULL);
      expect(schema.Done).toBe(PropertyType.BOOLEAN);
      expect(schema.Files).toBe(PropertyType.FILES);
      expect(schema.CreatedAt).toBe(PropertyType.DATE);
      expect(schema.UpdatedAt).toBe(PropertyType.DATE);
      expect(schema.Related).toBe(PropertyType.REFS);
      expect(schema.Assignees).toBe(PropertyType.REFS);
      expect(schema.Creator).toBe(PropertyType.REF);

      // Always includes cover and icon
      expect(schema.cover).toBe(PropertyType.FILE | PropertyType.NULL);
      expect(schema.icon).toBe(PropertyType.FILE | PropertyType.NULL);
    });

    it("should handle empty database properties", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: testId.toString("hex"),
        properties: {},
      });

      const schema = await getCollectionSchema(testKey, testId);

      // Only default properties
      expect(Object.keys(schema)).toEqual(["cover", "icon"]);
    });

    it("should use key and id from buffers correctly", async () => {
      const key = Buffer.from("my-api-key-in-hex", "utf8");
      const id = Buffer.from("my-database-uuid", "utf8");

      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: id.toString("hex"),
        properties: {},
      });

      await getCollectionSchema(key, id);

      expect(mockClient.databases.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: key.toString("hex"),
          database_id: id.toString("hex"),
        }),
      );
    });
  });
});
