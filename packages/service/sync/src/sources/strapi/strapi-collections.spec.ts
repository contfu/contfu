import { describe, expect, it, mock, beforeEach } from "bun:test";
import { PropertyType } from "@contfu/core";
import { articleSchema } from "./__fixtures__/strapi-api-results";

// Mock fetch globally
const mockFetch = mock(() => Promise.resolve(new Response()));

// Store original fetch
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as any;
});

// Import after mock setup
const { getCollectionSchema } = await import("./strapi-collections");

describe("strapi-collections", () => {
  describe("getCollectionSchema()", () => {
    it("should fetch and convert content type schema", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: articleSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await getCollectionSchema(
        "https://strapi.example.com",
        Buffer.from("api::article.article", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      // String types
      expect(schema.title).toBe(PropertyType.STRING);
      expect(schema.slug).toBe(PropertyType.STRING);
      expect(schema.description).toBe(PropertyType.STRING | PropertyType.NULL);

      // Boolean
      expect(schema.isFeatured).toBe(PropertyType.BOOLEAN);

      // Numbers
      expect(schema.views).toBe(PropertyType.NUMBER | PropertyType.NULL);
      expect(schema.rating).toBe(PropertyType.NUMBER | PropertyType.NULL);

      // Date
      expect(schema.publishDate).toBe(PropertyType.DATE | PropertyType.NULL);

      // Media
      expect(schema.featuredImage).toBe(PropertyType.FILE | PropertyType.NULL);
      expect(schema.gallery).toBe(PropertyType.FILES);

      // Relations
      expect(schema.author).toBe(PropertyType.REF | PropertyType.NULL);
      expect(schema.category).toBe(PropertyType.REF | PropertyType.NULL);
      expect(schema.tags).toBe(PropertyType.REFS);

      // Components
      expect(schema.seo).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.sections).toBe(PropertyType.STRINGS);

      // Blocks should not be in schema (stored as content)
      expect(schema.content).toBeUndefined();
    });

    it("should handle required fields without NULL type", async () => {
      const requiredFieldsSchema = {
        ...articleSchema,
        attributes: {
          requiredString: { type: "string", required: true },
          optionalString: { type: "string", required: false },
          requiredNumber: { type: "integer", required: true },
          optionalNumber: { type: "integer" },
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: requiredFieldsSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await getCollectionSchema(
        "https://strapi.example.com",
        Buffer.from("api::test.test", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      // Required fields should not have NULL
      expect(schema.requiredString).toBe(PropertyType.STRING);
      expect(schema.requiredNumber).toBe(PropertyType.NUMBER);

      // Optional fields should have NULL
      expect(schema.optionalString).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.optionalNumber).toBe(PropertyType.NUMBER | PropertyType.NULL);
    });

    it("should map all text field types correctly", async () => {
      const textFieldsSchema = {
        uid: "api::test.test",
        apiID: "test",
        kind: "collectionType",
        info: { displayName: "Test", singularName: "test", pluralName: "tests" },
        attributes: {
          stringField: { type: "string" },
          textField: { type: "text" },
          richtextField: { type: "richtext" },
          emailField: { type: "email" },
          uidField: { type: "uid" },
          enumField: { type: "enumeration" },
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: textFieldsSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await getCollectionSchema(
        "https://strapi.example.com",
        Buffer.from("api::test.test", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      expect(schema.stringField).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.textField).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.richtextField).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.emailField).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.uidField).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.enumField).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should map all numeric field types correctly", async () => {
      const numericFieldsSchema = {
        uid: "api::test.test",
        apiID: "test",
        kind: "collectionType",
        info: { displayName: "Test", singularName: "test", pluralName: "tests" },
        attributes: {
          integerField: { type: "integer" },
          bigintField: { type: "biginteger" },
          floatField: { type: "float" },
          decimalField: { type: "decimal" },
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: numericFieldsSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await getCollectionSchema(
        "https://strapi.example.com",
        Buffer.from("api::test.test", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      expect(schema.integerField).toBe(PropertyType.NUMBER | PropertyType.NULL);
      expect(schema.bigintField).toBe(PropertyType.NUMBER | PropertyType.NULL);
      expect(schema.floatField).toBe(PropertyType.NUMBER | PropertyType.NULL);
      expect(schema.decimalField).toBe(PropertyType.NUMBER | PropertyType.NULL);
    });

    it("should map all date field types correctly", async () => {
      const dateFieldsSchema = {
        uid: "api::test.test",
        apiID: "test",
        kind: "collectionType",
        info: { displayName: "Test", singularName: "test", pluralName: "tests" },
        attributes: {
          dateField: { type: "date" },
          datetimeField: { type: "datetime" },
          timeField: { type: "time" },
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: dateFieldsSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await getCollectionSchema(
        "https://strapi.example.com",
        Buffer.from("api::test.test", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      expect(schema.dateField).toBe(PropertyType.DATE | PropertyType.NULL);
      expect(schema.datetimeField).toBe(PropertyType.DATE | PropertyType.NULL);
      expect(schema.timeField).toBe(PropertyType.DATE | PropertyType.NULL);
    });

    it("should map relation types correctly", async () => {
      const relationFieldsSchema = {
        uid: "api::test.test",
        apiID: "test",
        kind: "collectionType",
        info: { displayName: "Test", singularName: "test", pluralName: "tests" },
        attributes: {
          oneToOne: { type: "relation", relation: "oneToOne", target: "api::other.other" },
          manyToOne: { type: "relation", relation: "manyToOne", target: "api::other.other" },
          oneToMany: { type: "relation", relation: "oneToMany", target: "api::other.other" },
          manyToMany: { type: "relation", relation: "manyToMany", target: "api::other.other" },
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: relationFieldsSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await getCollectionSchema(
        "https://strapi.example.com",
        Buffer.from("api::test.test", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      // To-one relations
      expect(schema.oneToOne).toBe(PropertyType.REF | PropertyType.NULL);
      expect(schema.manyToOne).toBe(PropertyType.REF | PropertyType.NULL);

      // To-many relations
      expect(schema.oneToMany).toBe(PropertyType.REFS);
      expect(schema.manyToMany).toBe(PropertyType.REFS);
    });

    it("should map component types correctly", async () => {
      const componentFieldsSchema = {
        uid: "api::test.test",
        apiID: "test",
        kind: "collectionType",
        info: { displayName: "Test", singularName: "test", pluralName: "tests" },
        attributes: {
          singleComponent: { type: "component", component: "shared.seo", repeatable: false },
          repeatableComponent: { type: "component", component: "shared.item", repeatable: true },
          dynamicZone: { type: "dynamiczone" },
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: componentFieldsSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await getCollectionSchema(
        "https://strapi.example.com",
        Buffer.from("api::test.test", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      expect(schema.singleComponent).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.repeatableComponent).toBe(PropertyType.STRINGS);
      expect(schema.dynamicZone).toBe(PropertyType.STRINGS);
    });

    it("should skip unknown field types", async () => {
      const unknownFieldsSchema = {
        uid: "api::test.test",
        apiID: "test",
        kind: "collectionType",
        info: { displayName: "Test", singularName: "test", pluralName: "tests" },
        attributes: {
          knownField: { type: "string" },
          unknownField: { type: "unknown-type" },
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: unknownFieldsSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await getCollectionSchema(
        "https://strapi.example.com",
        Buffer.from("api::test.test", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      expect(schema.knownField).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.unknownField).toBeUndefined();
    });
  });
});

// Restore original fetch after tests
globalThis.fetch = originalFetch;
