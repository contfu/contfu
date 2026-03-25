import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { PageProps } from "@contfu/core";
import type { ContentfulFetchOpts } from "./contentful";
import { ContentfulSource } from "./contentful-source";

function getProps(item: { props: unknown }): PageProps {
  return item.props as PageProps;
}

const MOCK_SPACE_ID = "test-space";
const MOCK_ENVIRONMENT = "master";
const MOCK_ACCESS_TOKEN = "test-token";
const MOCK_CONTENT_TYPE = "blogPost";

const blogPostEntry = {
  sys: {
    id: "entry123",
    type: "Entry",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T12:00:00.000Z",
    contentType: {
      sys: { id: MOCK_CONTENT_TYPE },
    },
  },
  fields: {
    title: { "en-US": "Test Blog Post" },
    slug: { "en-US": "test-blog-post" },
    body: {
      "en-US": {
        nodeType: "document",
        data: {},
        content: [
          {
            nodeType: "paragraph",
            data: {},
            content: [{ nodeType: "text", value: "Hello World", marks: [] }],
          },
        ],
      },
    },
  },
};

const contentTypeSchema = {
  sys: {
    id: MOCK_CONTENT_TYPE,
    type: "ContentType",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  name: "Blog Post",
  fields: [
    { id: "title", name: "Title", type: "Symbol", required: true },
    { id: "slug", name: "Slug", type: "Symbol", required: true },
    { id: "body", name: "Body", type: "RichText" },
  ],
};

let server: ReturnType<typeof Bun.serve>;
let serverUrl: string;

function startMockServer(): string {
  const port = 8765 + Math.floor(Math.random() * 1000);
  serverUrl = `http://localhost:${port}`;

  server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === `/spaces/${MOCK_SPACE_ID}/environments/${MOCK_ENVIRONMENT}/entries`) {
        const response = {
          sys: { type: "Array", total: 1, limit: 25, skip: 0 },
          items: [blogPostEntry],
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (
        url.pathname ===
        `/spaces/${MOCK_SPACE_ID}/environments/${MOCK_ENVIRONMENT}/content_types/${MOCK_CONTENT_TYPE}`
      ) {
        return new Response(JSON.stringify(contentTypeSchema), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  return serverUrl;
}

function stopMockServer() {
  void server?.stop();
}

describe.skip("ContentfulSource Integration", () => {
  beforeAll(() => {
    try {
      startMockServer();
    } catch {
      throw new Error("Failed to start mock server - make sure port is available");
    }
  });

  afterAll(() => {
    stopMockServer();
  });

  it("should fetch items from mock Contentful API", async () => {
    const source = new ContentfulSource();

    const items = await Array.fromAsync(
      source.fetch({
        collection: 1,
        ref: Buffer.from(MOCK_CONTENT_TYPE, "utf8"),
        spaceId: MOCK_SPACE_ID,
        environmentId: MOCK_ENVIRONMENT,
        credentials: Buffer.from(MOCK_ACCESS_TOKEN, "utf8"),
      }),
    );

    expect(items).toHaveLength(1);
    const item = items[0];

    expect(item.ref).toEqual(Buffer.from("entry123", "utf8"));
    expect(getProps(item).title).toBe("Test Blog Post");
    expect(getProps(item).slug).toBe("test-blog-post");
  });

  it("should convert rich text to blocks", async () => {
    const source = new ContentfulSource();

    const items = await Array.fromAsync(
      source.fetch({
        collection: 1,
        ref: Buffer.from(MOCK_CONTENT_TYPE, "utf8"),
        spaceId: MOCK_SPACE_ID,
        environmentId: MOCK_ENVIRONMENT,
        credentials: Buffer.from(MOCK_ACCESS_TOKEN, "utf8"),
      }),
    );

    expect(items).toHaveLength(1);
    const item = items[0];

    expect(item.content).toBeDefined();
    expect(item.content![0][0]).toBe("p");
  });

  it("should fetch and parse collection schema", async () => {
    const source = new ContentfulSource();

    const schema = await source.getCollectionSchema({
      collection: 1,
      ref: Buffer.from(MOCK_CONTENT_TYPE, "utf8"),
      spaceId: MOCK_SPACE_ID,
      environmentId: MOCK_ENVIRONMENT,
      credentials: Buffer.from(MOCK_ACCESS_TOKEN, "utf8"),
    });

    expect(schema.title).toBeDefined();
    expect(schema.slug).toBeDefined();
    expect(schema.body).toBeNull();
  });
});
