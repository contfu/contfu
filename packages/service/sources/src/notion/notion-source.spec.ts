import { describe, expect, it, beforeEach, setSystemTime, afterAll } from "bun:test";
import { PropertyType } from "@contfu/svc-core";
import type { NotionFetchOpts } from ".";
import { genUid, uuidToBuffer } from "../util/ids";
import { dbQueryPage1, dbQueryResult1, dbQueryResult2 } from "./__fixtures__/notion-query-results";
import { mockClient } from "./__tests__/notion-mock-setup";

const pullOpts: NotionFetchOpts = {
  ref: Buffer.alloc(16),
  credentials: "",
  collection: 1,
};

const { NotionSource } = await import("./notion-source");
const source = new NotionSource();

describe("NotionSource", () => {
  beforeEach(() => {
    mockClient.dataSources.query.mockClear();
    mockClient.dataSources.retrieve.mockClear();
    mockClient.databases.retrieve.mockClear();
    mockClient.blocks.children.list.mockClear();
    // Default mock: database has one data source
    mockClient.databases.retrieve.mockResolvedValue({
      object: "database",
      data_sources: [{ id: "data-source-id-1" }],
    });
  });

  describe("fetch()", () => {
    describe("full sync (no since)", () => {
      it("should get all pages from a collection from notion", async () => {
        mockClient.dataSources.query.mockResolvedValueOnce(dbQueryPage1);
        mockClient.blocks.children.list.mockResolvedValue({
          results: [],
        });

        const events = await Array.fromAsync(source.fetch(pullOpts));

        const rawRef1 = uuidToBuffer(dbQueryPage1.results[0].id);
        const rawRef2 = uuidToBuffer(dbQueryPage1.results[1].id);
        const id1 = genUid(rawRef1);
        const id2 = genUid(rawRef2);
        const otherId = genUid(
          uuidToBuffer(dbQueryPage1.results[0].properties["Other Reference"].relation[0].id),
        );
        expect(events).toEqual([
          {
            id: id1,
            ref: rawRef1,
            collection: 1,
            changedAt: 1716353760000,
            props: {
              color: "red",
              description: "A",
              otherReference: [otherId.toString("base64url")],
              selfReference: [id2.toString("base64url")],
              title: "Foo",
              createdAt: 1711864560000,
            },
          },
          {
            id: id2,
            ref: rawRef2,
            collection: 1,
            changedAt: 1716353820000,
            props: {
              color: "blue",
              description: "B",
              otherReference: [],
              selfReference: [id1.toString("base64url")],
              slug: "/bar",
              title: "Bar",
              createdAt: 1711864560000,
            },
          },
        ]);
      });

      it("should apply onOrBefore filter for full sync", async () => {
        setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

        mockClient.dataSources.query.mockResolvedValueOnce({
          ...dbQueryPage1,
          results: [],
        });
        mockClient.blocks.children.list.mockResolvedValue({ results: [] });

        await Array.fromAsync(source.fetch(pullOpts));

        const callArgs = mockClient.dataSources.query.mock.calls[0][0];
        expect(callArgs.filter).toBeDefined();
        expect(callArgs.filter.and).toHaveLength(2);

        // Should filter by last_edited_time and created_time
        const lastEditedFilter = callArgs.filter.and.find(
          (f: Record<string, unknown>) => f.timestamp === "last_edited_time",
        );
        const createdFilter = callArgs.filter.and.find(
          (f: Record<string, unknown>) => f.timestamp === "created_time",
        );

        expect(lastEditedFilter).toBeDefined();
        expect(createdFilter).toBeDefined();

        setSystemTime();
      });

      it("should sort by created_time ascending", async () => {
        mockClient.dataSources.query.mockResolvedValueOnce({
          ...dbQueryPage1,
          results: [],
        });

        await Array.fromAsync(source.fetch(pullOpts));

        const callArgs = mockClient.dataSources.query.mock.calls[0][0];
        expect(callArgs.sorts).toEqual([{ timestamp: "created_time", direction: "ascending" }]);
      });
    });

    describe("incremental sync (with since)", () => {
      it("should get changed pages from a collection, if since is provided", async () => {
        mockClient.dataSources.query.mockResolvedValueOnce({
          ...dbQueryPage1,
          results: [dbQueryResult1],
        });
        mockClient.blocks.children.list.mockResolvedValue({ results: [] });

        const events = await Array.fromAsync(source.fetch({ ...pullOpts, since: 1711864560000 }));

        const id1 = genUid(uuidToBuffer(dbQueryPage1.results[0].id));
        expect(events).toEqual([expect.objectContaining({ id: id1 })]);
      });

      it("should apply createdOrUpdated filter for incremental sync", async () => {
        setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

        mockClient.dataSources.query.mockResolvedValueOnce({
          ...dbQueryPage1,
          results: [],
        });

        const since = new Date("2024-06-01T00:00:00.000Z").getTime();
        await Array.fromAsync(source.fetch({ ...pullOpts, since }));

        const callArgs = mockClient.dataSources.query.mock.calls[0][0];
        expect(callArgs.filter).toBeDefined();
        expect(callArgs.filter.and).toHaveLength(1);

        // Should filter by created_time with after and on_or_before
        const createdFilter = callArgs.filter.and[0];
        expect(createdFilter.timestamp).toBe("created_time");
        expect(createdFilter.created_time.after).toBe(new Date(since).toISOString());

        setSystemTime();
      });

      it("should use 10 seconds buffer for until timestamp", async () => {
        const fixedTime = new Date("2024-06-15T12:00:30.000Z");
        setSystemTime(fixedTime);

        mockClient.dataSources.query.mockResolvedValueOnce({
          ...dbQueryPage1,
          results: [],
        });

        await Array.fromAsync(source.fetch(pullOpts));

        const callArgs = mockClient.dataSources.query.mock.calls[0][0];
        const lastEditedFilter = callArgs.filter.and.find(
          (f: Record<string, unknown>) => f.timestamp === "last_edited_time",
        );

        // Until should be 10 seconds before current time, rounded to seconds
        const expectedUntil = new Date("2024-06-15T12:00:20.000Z").toISOString();
        expect(lastEditedFilter.last_edited_time.on_or_before).toBe(expectedUntil);

        setSystemTime();
      });
    });

    describe("empty database handling", () => {
      it("should handle empty database gracefully", async () => {
        mockClient.dataSources.query.mockResolvedValueOnce({
          object: "list",
          results: [],
          next_cursor: null,
          has_more: false,
        });

        const events = await Array.fromAsync(source.fetch(pullOpts));

        expect(events).toHaveLength(0);
      });

      it("should handle database with only unsupported objects", async () => {
        mockClient.dataSources.query.mockResolvedValueOnce({
          object: "list",
          results: [
            { object: "database", id: "db-123" }, // Not a page
          ],
          next_cursor: null,
          has_more: false,
        });

        const events = await Array.fromAsync(source.fetch(pullOpts));

        expect(events).toHaveLength(0);
      });
    });

    describe("pagination", () => {
      it("should handle multiple pages of results", async () => {
        mockClient.dataSources.query
          .mockResolvedValueOnce({
            object: "list",
            results: [dbQueryResult1],
            next_cursor: "cursor-123",
            has_more: true,
          })
          .mockResolvedValueOnce({
            object: "list",
            results: [dbQueryResult2],
            next_cursor: null,
            has_more: false,
          });
        mockClient.blocks.children.list.mockResolvedValue({ results: [] });

        const events = await Array.fromAsync(source.fetch(pullOpts));

        expect(events).toHaveLength(2);
        expect(mockClient.dataSources.query).toHaveBeenCalledTimes(2);
      });

      it("should handle many pages of pagination", async () => {
        // Simulate 3 pages with 1 result each
        mockClient.dataSources.query
          .mockResolvedValueOnce({
            object: "list",
            results: [dbQueryResult1],
            next_cursor: "cursor-1",
            has_more: true,
          })
          .mockResolvedValueOnce({
            object: "list",
            results: [{ ...dbQueryResult1, id: "11111111-1111-1111-1111-111111111112" }],
            next_cursor: "cursor-2",
            has_more: true,
          })
          .mockResolvedValueOnce({
            object: "list",
            results: [{ ...dbQueryResult2, id: "11111111-1111-1111-1111-111111111113" }],
            next_cursor: null,
            has_more: false,
          });
        mockClient.blocks.children.list.mockResolvedValue({ results: [] });

        const events = await Array.fromAsync(source.fetch(pullOpts));

        expect(events).toHaveLength(3);
        expect(mockClient.dataSources.query).toHaveBeenCalledTimes(3);
      });
    });

    describe("content blocks", () => {
      it("should include content blocks in items", async () => {
        mockClient.dataSources.query.mockResolvedValueOnce({
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
                rich_text: [
                  {
                    type: "text",
                    plain_text: "Hello world",
                    annotations: {
                      bold: false,
                      italic: false,
                      code: false,
                    },
                    href: null,
                  },
                ],
                color: "default",
              },
            },
          ],
          has_more: false,
        });

        const events = await Array.fromAsync(source.fetch(pullOpts));

        expect(events[0].content).toBeDefined();
        expect(events[0].content).toHaveLength(1);
        expect(events[0].content![0]).toEqual(["p", ["Hello world"]]);
      });

      it("should not include content key when no blocks", async () => {
        mockClient.dataSources.query.mockResolvedValueOnce({
          ...dbQueryPage1,
          results: [dbQueryResult1],
        });
        mockClient.blocks.children.list.mockResolvedValueOnce({
          results: [],
          has_more: false,
        });

        const events = await Array.fromAsync(source.fetch(pullOpts));

        expect(events[0].content).toBeUndefined();
      });
    });

    describe("error handling", () => {
      it("should propagate API errors", async () => {
        mockClient.dataSources.query.mockRejectedValueOnce(new Error("API Error: Rate limited"));

        await expect(Array.fromAsync(source.fetch(pullOpts))).rejects.toThrow("API Error");
      });
    });
  });

  describe("getCollectionSchema()", () => {
    const dataSourceId = "test-data-source-id";

    it("should fetch and return collection schema", async () => {
      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: pullOpts.ref.toString("hex"),
        data_sources: [{ id: dataSourceId }],
      });
      mockClient.dataSources.retrieve.mockResolvedValueOnce({
        object: "data_source",
        id: dataSourceId,
        properties: {
          Title: { id: "title", type: "title", title: {} },
          Description: { id: "desc", type: "rich_text", rich_text: {} },
          Status: { id: "status", type: "select", select: { options: [] } },
          Count: { id: "count", type: "number", number: { format: "number" } },
          Done: { id: "done", type: "checkbox", checkbox: {} },
        },
      });

      const schema = await source.getCollectionSchema(pullOpts);

      expect(schema.title).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.description).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.status).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.count).toBe(PropertyType.NUMBER | PropertyType.NULL);
      expect(schema.done).toBe(PropertyType.BOOLEAN);

      // Should always include cover and icon
      expect(schema.cover).toBe(PropertyType.FILE | PropertyType.NULL);
      expect(schema.icon).toBe(PropertyType.FILE | PropertyType.NULL);
    });

    it("should pass credentials and ref to API", async () => {
      const customOpts: NotionFetchOpts = {
        ref: Buffer.from("custom-database-id", "utf8"),
        credentials: "custom-api-key",
        collection: 2,
      };
      const customDataSourceId = "custom-data-source-id";

      mockClient.databases.retrieve.mockResolvedValueOnce({
        object: "database",
        id: customOpts.ref.toString("hex"),
        data_sources: [{ id: customDataSourceId }],
      });
      mockClient.dataSources.retrieve.mockResolvedValueOnce({
        object: "data_source",
        id: customDataSourceId,
        properties: {},
      });

      await source.getCollectionSchema(customOpts);

      expect(mockClient.databases.retrieve).toHaveBeenCalledWith({
        auth: customOpts.credentials,
        database_id: "custom-database-id",
      });
      expect(mockClient.dataSources.retrieve).toHaveBeenCalledWith({
        auth: customOpts.credentials,
        data_source_id: customDataSourceId,
      });
    });
  });
});

describe("filter functions", () => {
  beforeEach(() => {
    mockClient.databases.retrieve.mockClear();
    mockClient.dataSources.query.mockClear();
    mockClient.blocks.children.list.mockResolvedValue({ results: [] });
    // Default mock: database has one data source
    mockClient.databases.retrieve.mockResolvedValue({
      object: "database",
      data_sources: [{ id: "data-source-id-1" }],
    });
  });

  afterAll(() => {
    setSystemTime();
  });

  it("should format dates as ISO strings", async () => {
    const fixedTime = new Date("2024-06-15T12:00:30.000Z");
    setSystemTime(fixedTime);

    mockClient.dataSources.query.mockResolvedValueOnce({
      ...dbQueryPage1,
      results: [],
    });

    const since = new Date("2024-06-01T08:30:00.000Z").getTime();
    await Array.fromAsync(source.fetch({ ...pullOpts, since }));

    const callArgs = mockClient.dataSources.query.mock.calls[0][0];
    const createdFilter = callArgs.filter.and[0];

    // Should be ISO string format
    expect(createdFilter.created_time.after).toBe("2024-06-01T08:30:00.000Z");
    expect(createdFilter.created_time.on_or_before).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    setSystemTime();
  });

  it("should handle edge case timestamps correctly", async () => {
    // Test with Unix epoch
    setSystemTime(new Date("2024-01-01T00:00:10.000Z"));

    mockClient.dataSources.query.mockResolvedValueOnce({
      ...dbQueryPage1,
      results: [],
    });

    await Array.fromAsync(source.fetch(pullOpts));

    const callArgs = mockClient.dataSources.query.mock.calls[0][0];
    const lastEditedFilter = callArgs.filter.and.find(
      (f: Record<string, unknown>) => f.timestamp === "last_edited_time",
    );

    // 10 seconds before 2024-01-01T00:00:10.000Z = 2024-01-01T00:00:00.000Z
    expect(lastEditedFilter.last_edited_time.on_or_before).toBe("2024-01-01T00:00:00.000Z");

    setSystemTime();
  });
});
