import { describe, expect, it, beforeEach } from "bun:test";
import { PropertyType } from "@contfu/svc-core";
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

// Helper to setup mocks for database + data source
function setupMocks(
  testId: Buffer,
  properties: Record<string, unknown>,
  dataSourceId = "data-source-123",
) {
  // Mock database retrieve to return a database with data_sources reference
  mockClient.databases.retrieve.mockResolvedValueOnce({
    object: "database",
    id: testId.toString("hex"),
    data_sources: [{ id: dataSourceId }],
  });

  // Mock data source retrieve to return the properties
  mockClient.dataSources.retrieve.mockResolvedValueOnce({
    object: "data_source",
    id: dataSourceId,
    properties,
  });
}

describe("notion-collections", () => {
  beforeEach(() => {
    mockClient.databases.retrieve.mockClear();
    mockClient.dataSources.retrieve.mockClear();
  });

  describe("getCollectionSchema()", () => {
    const testKey = "test-api-key";
    const testId = Buffer.from("database-id-123", "utf8");

    it("should include default cover and icon properties", async () => {
      setupMocks(testId, {});

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.cover).toBe(PropertyType.FILE | PropertyType.NULL);
      expect(schema.icon).toBe(PropertyType.FILE | PropertyType.NULL);
    });

    it("should map title property to STRING | NULL", async () => {
      setupMocks(testId, {
        Title: createDbProperty("title"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.title).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map rich_text property to STRING | NULL", async () => {
      setupMocks(testId, {
        Description: createDbProperty("rich_text"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.description).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map url property to STRING | NULL", async () => {
      setupMocks(testId, {
        Link: createDbProperty("url"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.link).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map email property to STRING | NULL", async () => {
      setupMocks(testId, {
        Email: createDbProperty("email"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.email).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map phone_number property to STRING | NULL", async () => {
      setupMocks(testId, {
        Phone: createDbProperty("phone_number"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.phone).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map status property to STRING | NULL", async () => {
      setupMocks(testId, {
        Status: createDbProperty("status", {
          options: [{ name: "Active" }, { name: "Done" }],
        }),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.status).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map select property to STRING | NULL", async () => {
      setupMocks(testId, {
        Category: createDbProperty("select", {
          options: [{ name: "A" }, { name: "B" }],
        }),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.category).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map number property to NUMBER | NULL", async () => {
      setupMocks(testId, {
        Count: createDbProperty("number", { format: "number" }),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.count).toBe(PropertyType.NUMBER | PropertyType.NULL);
    });

    it("should map date property to DATE | NULL", async () => {
      setupMocks(testId, {
        Due: createDbProperty("date"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.due).toBe(PropertyType.DATE | PropertyType.NULL);
    });

    it("should map checkbox property to BOOLEAN (without NULL)", async () => {
      setupMocks(testId, {
        Done: createDbProperty("checkbox"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.done).toBe(PropertyType.BOOLEAN);
    });

    it("should map files property to FILES", async () => {
      setupMocks(testId, {
        Attachments: createDbProperty("files"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.attachments).toBe(PropertyType.FILES);
    });

    it("should map created_time property to DATE (without NULL)", async () => {
      setupMocks(testId, {
        Created: createDbProperty("created_time"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.created).toBe(PropertyType.DATE);
    });

    it("should map last_edited_time property to DATE (without NULL)", async () => {
      setupMocks(testId, {
        Modified: createDbProperty("last_edited_time"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.modified).toBe(PropertyType.DATE);
    });

    it("should map relation property to REFS", async () => {
      setupMocks(testId, {
        Related: createDbProperty("relation", {
          database_id: "other-db-id",
          type: "dual_property",
        }),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.related).toBe(PropertyType.REFS);
    });

    it("should map people property to REFS", async () => {
      setupMocks(testId, {
        Assignees: createDbProperty("people"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.assignees).toBe(PropertyType.REFS);
    });

    it("should map created_by property to REF", async () => {
      setupMocks(testId, {
        Creator: createDbProperty("created_by"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.creator).toBe(PropertyType.REF);
    });

    it("should map last_edited_by property to REF", async () => {
      setupMocks(testId, {
        Editor: createDbProperty("last_edited_by"),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.editor).toBe(PropertyType.REF);
    });

    it("should skip unsupported property types", async () => {
      setupMocks(testId, {
        Formula: createDbProperty("formula", { expression: "1+1" }),
        Rollup: createDbProperty("rollup", { function: "sum" }),
      });

      const schema = await getCollectionSchema(testKey, testId);

      // Formula and rollup are computed types - not stored
      expect(schema.formula).toBeUndefined();
      expect(schema.rollup).toBeUndefined();
    });

    it("should map multi_select property to STRINGS | NULL", async () => {
      setupMocks(testId, {
        Tags: createDbProperty("multi_select", { options: [] }),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.tags).toBe(PropertyType.STRINGS | PropertyType.NULL);
    });

    it("should map unique_id property to STRING", async () => {
      setupMocks(testId, {
        ID: createDbProperty("unique_id", { prefix: "ID" }),
      });

      const schema = await getCollectionSchema(testKey, testId);

      expect(schema.iD).toBe(PropertyType.STRING);
    });

    it("should handle database with multiple properties", async () => {
      setupMocks(testId, {
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
      });

      const schema = await getCollectionSchema(testKey, testId);

      // Verify all expected properties are present (keys are camelCased)
      expect(schema.title).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.description).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.status).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.priority).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.count).toBe(PropertyType.NUMBER | PropertyType.NULL);
      expect(schema.dueDate).toBe(PropertyType.DATE | PropertyType.NULL);
      expect(schema.done).toBe(PropertyType.BOOLEAN);
      expect(schema.files).toBe(PropertyType.FILES);
      expect(schema.createdAt).toBe(PropertyType.DATE);
      expect(schema.updatedAt).toBe(PropertyType.DATE);
      expect(schema.related).toBe(PropertyType.REFS);
      expect(schema.assignees).toBe(PropertyType.REFS);
      expect(schema.creator).toBe(PropertyType.REF);

      // Always includes cover and icon
      expect(schema.cover).toBe(PropertyType.FILE | PropertyType.NULL);
      expect(schema.icon).toBe(PropertyType.FILE | PropertyType.NULL);
    });

    it("should handle empty database properties", async () => {
      setupMocks(testId, {});

      const schema = await getCollectionSchema(testKey, testId);

      // Only default properties
      expect(Object.keys(schema)).toEqual(["cover", "icon"]);
    });

    it("should use key and id correctly", async () => {
      const key = "my-api-key";
      const id = Buffer.from("my-database-uuid", "utf8");
      const dataSourceId = "test-data-source-id";

      setupMocks(id, {}, dataSourceId);

      await getCollectionSchema(key, id);

      expect(mockClient.databases.retrieve).toHaveBeenCalledWith({
        auth: key,
        database_id: "my-database-uuid",
      });

      expect(mockClient.dataSources.retrieve).toHaveBeenCalledWith({
        auth: key,
        data_source_id: dataSourceId,
      });
    });
  });
});
