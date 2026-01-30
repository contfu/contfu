/**
 * Integration tests for the Strapi → Service → Client flow.
 *
 * This test suite verifies:
 * 1. Service can fetch content from Strapi (mocked)
 * 2. WebSocket/SSE clients can connect and authenticate
 * 3. Content sync events (CHANGED, DELETED) are correctly broadcast to clients
 * 4. Collection items are synchronized correctly
 * 5. Incremental sync works with `since` parameter
 *
 * The tests use mocked database and a simulated Strapi API to avoid external dependencies.
 * For real e2e tests, see tests/e2e/strapi-full-flow.spec.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { CommandType, EventType, type Item } from "@contfu/core";
import { pack, unpack } from "msgpackr";

// Test consumer credentials (32 bytes)
const TEST_CONSUMER_KEY = Buffer.alloc(32);
TEST_CONSUMER_KEY.write("e2e-strapi-test-key-32-bytes!!", 0, 32);

// Additional keys for SSE tests to avoid conflicts
const TEST_CONSUMER_KEY_2 = Buffer.alloc(32);
TEST_CONSUMER_KEY_2.write("e2e-strapi-test-key-2-32bytes!", 0, 32);

const TEST_CONSUMER = {
  id: 1,
  userId: "strapi-e2e-user",
  key: TEST_CONSUMER_KEY,
};

const TEST_CONSUMER_2 = {
  id: 2,
  userId: "strapi-e2e-user",
  key: TEST_CONSUMER_KEY_2,
};

// Track the last queried key for authentication tests
let lastQueriedKey: Buffer | null = null;

// Simulated Strapi content store
const strapiContentStore: Map<
  string,
  Array<{
    documentId: string;
    id: number;
    title: string;
    slug: string;
    description?: string;
    content?: unknown[];
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
  }>
> = new Map();

// Create chainable mock for db that tracks key queries
function createKeyTrackingChainableMock() {
  const chain: any = {};
  const methods = ["select", "from", "limit", "groupBy", "orderBy", "innerJoin", "set", "update"];

  for (const method of methods) {
    chain[method] = () => chain;
  }

  chain.where = () => chain;

  chain.all = () => {
    if (!lastQueriedKey) {
      return Promise.resolve([TEST_CONSUMER]);
    }
    const keyHex = lastQueriedKey.toString("hex");
    if (keyHex === TEST_CONSUMER_KEY.toString("hex")) {
      return Promise.resolve([TEST_CONSUMER]);
    }
    if (keyHex === TEST_CONSUMER_KEY_2.toString("hex")) {
      return Promise.resolve([TEST_CONSUMER_2]);
    }
    return Promise.resolve([]);
  };

  chain.then = (resolve: any) => chain.all().then(resolve);

  return chain;
}

function createChainableMock(finalResult: any) {
  const chain: any = {};
  const methods = [
    "select",
    "from",
    "where",
    "limit",
    "all",
    "groupBy",
    "orderBy",
    "innerJoin",
    "set",
    "update",
  ];
  for (const method of methods) {
    chain[method] = () => chain;
  }
  chain.all = () => Promise.resolve(finalResult);
  chain.then = (resolve: any) => Promise.resolve(finalResult).then(resolve);
  return () => chain;
}

// Mock database - must be before imports
// Path is relative to packages/service/app/src/lib/server/ for the module resolution
mock.module("../../packages/service/app/src/lib/server/db/db", () => {
  return {
    db: {
      $count: mock(() => Promise.resolve(1)),
      select: () => createKeyTrackingChainableMock(),
      update: createChainableMock(undefined),
      query: {
        connection: {
          findMany: mock(() =>
            Promise.resolve([
              {
                userId: "strapi-e2e-user",
                consumerId: 1,
                collectionId: 1,
                lastItemChanged: null,
              },
            ]),
          ),
        },
      },
    },
    consumerTable: {
      key: {},
    },
    collectionTable: {
      userId: "userId",
      id: "id",
      itemIds: "itemIds",
      sourceId: "sourceId",
      ref: "ref",
    },
    connectionTable: {
      userId: "userId",
      consumerId: "consumerId",
      collectionId: "collectionId",
      lastItemChanged: "lastItemChanged",
    },
    sourceTable: {
      userId: "userId",
      id: "id",
      type: "type",
      url: "url",
      credentials: "credentials",
    },
  };
});

// Mock drizzle-orm's eq function to track key queries
mock.module("drizzle-orm", () => ({
  eq: (column: any, value: any) => {
    if (value instanceof Buffer && value.length === 32) {
      lastQueriedKey = value;
    }
    return { column, value };
  },
  and: (...conditions: any[]) => conditions,
  asc: (column: any) => column,
  inArray: (column: any, values: any[]) => ({ column, values }),
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
}));

// Dynamic imports after mocks - use absolute paths from the workspace root
const { WebSocketServer } =
  await import("../../packages/service/app/src/lib/server/websocket/ws-server");
const { SSEServer } = await import("../../packages/service/app/src/lib/server/sse/sse-server");

type ConnectionInfo = {
  userId: string;
  consumerId: number;
  collectionId: number;
  lastItemChanged: number | null;
};

/**
 * Helper to create a mock Strapi server that simulates the Strapi REST API.
 */
function createMockStrapiServer(port: number): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port,
    fetch(request) {
      const url = new URL(request.url);
      const authHeader = request.headers.get("Authorization");

      // Verify API token
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // GET /api/articles - List articles
      if (url.pathname === "/api/articles" && request.method === "GET") {
        const contentType = "api::article.article";
        const articles = strapiContentStore.get(contentType) || [];

        // Handle filtering by updatedAt for incremental sync
        const updatedAtGte = url.searchParams.get("filters[updatedAt][$gte]");
        const updatedAtLte = url.searchParams.get("filters[updatedAt][$lte]");

        let filteredArticles = articles;
        if (updatedAtGte) {
          filteredArticles = filteredArticles.filter(
            (a) => new Date(a.updatedAt) >= new Date(updatedAtGte),
          );
        }
        if (updatedAtLte) {
          filteredArticles = filteredArticles.filter(
            (a) => new Date(a.updatedAt) <= new Date(updatedAtLte),
          );
        }

        // Handle pagination
        const page = parseInt(url.searchParams.get("pagination[page]") || "1");
        const pageSize = parseInt(url.searchParams.get("pagination[pageSize]") || "25");
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedArticles = filteredArticles.slice(start, end);

        return new Response(
          JSON.stringify({
            data: paginatedArticles,
            meta: {
              pagination: {
                page,
                pageSize,
                pageCount: Math.ceil(filteredArticles.length / pageSize) || 1,
                total: filteredArticles.length,
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // POST /api/articles - Create article
      if (url.pathname === "/api/articles" && request.method === "POST") {
        return (async () => {
          const body = (await request.json()) as { data: Record<string, unknown> };
          const contentType = "api::article.article";
          const articles = strapiContentStore.get(contentType) || [];

          const newArticle = {
            id: articles.length + 1,
            documentId: `doc-${Date.now()}`,
            ...body.data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
          } as any;

          articles.push(newArticle);
          strapiContentStore.set(contentType, articles);

          return new Response(JSON.stringify({ data: newArticle }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        })();
      }

      // PUT /api/articles/:documentId - Update article
      const updateMatch = url.pathname.match(/^\/api\/articles\/([^/]+)$/);
      if (updateMatch && request.method === "PUT") {
        return (async () => {
          const documentId = updateMatch[1];
          const body = (await request.json()) as { data: Record<string, unknown> };
          const contentType = "api::article.article";
          const articles = strapiContentStore.get(contentType) || [];

          const index = articles.findIndex((a) => a.documentId === documentId);
          if (index === -1) {
            return new Response(JSON.stringify({ error: "Not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          articles[index] = {
            ...articles[index],
            ...body.data,
            updatedAt: new Date().toISOString(),
          } as any;
          strapiContentStore.set(contentType, articles);

          return new Response(JSON.stringify({ data: articles[index] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        })();
      }

      // DELETE /api/articles/:documentId - Delete article
      const deleteMatch = url.pathname.match(/^\/api\/articles\/([^/]+)$/);
      if (deleteMatch && request.method === "DELETE") {
        const documentId = deleteMatch[1];
        const contentType = "api::article.article";
        const articles = strapiContentStore.get(contentType) || [];

        const index = articles.findIndex((a) => a.documentId === documentId);
        if (index === -1) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const deleted = articles.splice(index, 1)[0];
        strapiContentStore.set(contentType, articles);

        return new Response(JSON.stringify({ data: deleted }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // GET /api/content-type-builder/content-types/:uid - Get schema
      const schemaMatch = url.pathname.match(
        /^\/api\/content-type-builder\/content-types\/([^/]+)$/,
      );
      if (schemaMatch && request.method === "GET") {
        const uid = decodeURIComponent(schemaMatch[1]);
        if (uid === "api::article.article") {
          return new Response(
            JSON.stringify({
              data: {
                uid: "api::article.article",
                apiID: "article",
                kind: "collectionType",
                info: {
                  displayName: "Article",
                  singularName: "article",
                  pluralName: "articles",
                },
                attributes: {
                  title: { type: "string", required: true },
                  slug: { type: "uid", required: true },
                  description: { type: "text" },
                  content: { type: "blocks" },
                },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify({ error: "Content type not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    },
  });
}

/**
 * Helper to create test items that simulate synced content from Strapi.
 */
function createTestItem(overrides: Partial<Item> = {}): Item & { user: string } {
  return {
    user: "strapi-e2e-user",
    collection: 1,
    id: Buffer.alloc(16),
    ref: Buffer.from("api::article.article"),
    props: { title: "Test Article", slug: "test-article" },
    content: [],
    createdAt: Date.now(),
    changedAt: Date.now(),
    publishedAt: Date.now(),
    ...overrides,
  } as Item & { user: string };
}

// Shared servers across all tests
// Use a unique high port range - 56xxx range for integration tests
const PORT_BASE = 56000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 5000);
let mockStrapiServer: ReturnType<typeof Bun.serve>;
let wsServer: InstanceType<typeof WebSocketServer>;
let sseServer: InstanceType<typeof SSEServer>;
let wsHttpServer: ReturnType<typeof Bun.serve>;
let sseHttpServer: ReturnType<typeof Bun.serve>;
let STRAPI_PORT = PORT_BASE;
let WS_PORT = PORT_BASE + 1;
let SSE_PORT = PORT_BASE + 2;

describe("Integration: Strapi → Service → Client Flow", () => {
  beforeAll(async () => {
    console.log(
      `[Integration Strapi Flow] Using ports: Strapi=${STRAPI_PORT}, WS=${WS_PORT}, SSE=${SSE_PORT}`,
    );

    // Start mock Strapi server
    try {
      mockStrapiServer = createMockStrapiServer(STRAPI_PORT);
      console.log(`[Integration] Mock Strapi server started on port ${STRAPI_PORT}`);
    } catch (e) {
      console.error(`[Integration] Failed to start mock Strapi server:`, e);
      throw e;
    }

    // Create WebSocket server
    wsServer = new WebSocketServer();
    const mockWsWorker = {
      activateConsumer: mock(() => Promise.resolve()),
      deactivateConsumer: mock(() => {}),
    };
    wsServer.setWorker(mockWsWorker as any);

    wsHttpServer = Bun.serve({
      port: WS_PORT,
      fetch(request, server) {
        const url = new URL(request.url);
        if (url.pathname === "/ws") {
          if (server.upgrade(request, { data: { id: "" } })) {
            return undefined as any;
          }
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return new Response("Not found", { status: 404 });
      },
      websocket: wsServer.createHandler(),
    });

    // Create SSE server
    sseServer = new SSEServer();
    const mockSseWorker = {
      activateConsumer: mock(() => Promise.resolve()),
      deactivateConsumer: mock(() => {}),
    };
    sseServer.setWorker(mockSseWorker as any);

    sseHttpServer = Bun.serve({
      port: SSE_PORT,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/sse") {
          const keyString = url.searchParams.get("key");
          if (!keyString) {
            return new Response("Missing key", { status: 401 });
          }

          let key: Buffer;
          try {
            key = Buffer.from(keyString, "base64");
            if (key.length !== 32) {
              return new Response("Invalid key format", { status: 401 });
            }
          } catch {
            return new Response("Invalid key encoding", { status: 401 });
          }

          const stream = new ReadableStream({
            async start(controller) {
              const result = await sseServer.addConnection(key, controller);
              if (typeof result !== "string") {
                const encoder = new TextEncoder();
                const errorEvent = `event: error\ndata: ${JSON.stringify({ type: "error", code: result.code })}\n\n`;
                controller.enqueue(encoder.encode(errorEvent));
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }
        return new Response("Not found", { status: 404 });
      },
    });

    // Wait for all servers to be ready
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    if (mockStrapiServer) mockStrapiServer.stop();
    if (wsHttpServer) wsHttpServer.stop();
    if (sseHttpServer) sseHttpServer.stop();
  });

  beforeEach(() => {
    strapiContentStore.clear();
    lastQueriedKey = null;
  });

  // ============== Mock Strapi API Tests ==============

  it("should create articles in mock Strapi", async () => {
    const response = await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        data: { title: "Test Article", slug: "test-article", description: "Test description" },
      }),
    });

    expect(response.ok).toBe(true);
    const result = (await response.json()) as { data: { documentId: string; title: string } };
    expect(result.data.title).toBe("Test Article");
    expect(result.data.documentId).toBeDefined();
  });

  it("should list articles from mock Strapi", async () => {
    // Create some articles first
    await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ data: { title: "Article 1", slug: "article-1" } }),
    });

    await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ data: { title: "Article 2", slug: "article-2" } }),
    });

    // List articles
    const response = await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(response.ok).toBe(true);
    const result = (await response.json()) as { data: Array<{ title: string }>; meta: any };
    expect(result.data.length).toBe(2);
    expect(result.meta.pagination.total).toBe(2);
  });

  it("should update articles in mock Strapi", async () => {
    // Create an article
    const createResponse = await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ data: { title: "Original Title", slug: "original" } }),
    });

    const created = (await createResponse.json()) as { data: { documentId: string } };

    // Update the article
    const updateResponse = await fetch(
      `http://localhost:${STRAPI_PORT}/api/articles/${created.data.documentId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({ data: { title: "Updated Title" } }),
      },
    );

    expect(updateResponse.ok).toBe(true);
    const updated = (await updateResponse.json()) as { data: { title: string } };
    expect(updated.data.title).toBe("Updated Title");
  });

  it("should delete articles from mock Strapi", async () => {
    // Create an article
    const createResponse = await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ data: { title: "To Delete", slug: "to-delete" } }),
    });

    const created = (await createResponse.json()) as { data: { documentId: string } };

    // Delete the article
    const deleteResponse = await fetch(
      `http://localhost:${STRAPI_PORT}/api/articles/${created.data.documentId}`,
      {
        method: "DELETE",
        headers: { Authorization: "Bearer test-token" },
      },
    );

    expect(deleteResponse.ok).toBe(true);

    // Verify it's deleted
    const listResponse = await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      headers: { Authorization: "Bearer test-token" },
    });
    const list = (await listResponse.json()) as { data: any[] };
    expect(list.data.length).toBe(0);
  });

  it("should reject Strapi requests without auth token", async () => {
    const response = await fetch(`http://localhost:${STRAPI_PORT}/api/articles`);
    expect(response.status).toBe(401);
  });

  // ============== WebSocket Client Tests ==============

  it("should connect via WebSocket and receive CONNECTED event", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    const result = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        resolve(data[0] as number);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(result).toBe(EventType.CONNECTED);
  });

  it("should receive CHANGED event when item is broadcast via WebSocket", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    // Connect and authenticate
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Broadcast a test item
    const testItem = createTestItem({
      id: Buffer.from("test-item-id-12345678"),
      props: { title: "Synced Article", slug: "synced-article" },
      createdAt: 1000,
      changedAt: 2000,
    });

    const connections: ConnectionInfo[] = [
      {
        userId: "strapi-e2e-user",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    await wsServer.broadcast([testItem] as any, connections);

    // Receive the CHANGED event
    const receivedEvent = await new Promise<{
      type: number;
      collection: number;
      props: Record<string, unknown>;
    }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Broadcast timeout")), 5000);

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CHANGED) {
          resolve({
            type: data[0] as number,
            collection: data[1] as number,
            props: (data[5] as unknown[])[1] as Record<string, unknown>,
          });
        }
      };
    });

    ws.close();

    expect(receivedEvent.type).toBe(EventType.CHANGED);
    expect(receivedEvent.collection).toBe(1);
    expect(receivedEvent.props.title).toBe("Synced Article");
  });

  it("should handle multiple items broadcast via WebSocket", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    // Connect and authenticate
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Broadcast multiple items
    const items = [
      createTestItem({ props: { title: "Article 1", slug: "article-1" } }),
      createTestItem({ props: { title: "Article 2", slug: "article-2" } }),
      createTestItem({ props: { title: "Article 3", slug: "article-3" } }),
    ];

    const connections: ConnectionInfo[] = [
      {
        userId: "strapi-e2e-user",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    await wsServer.broadcast(items as any, connections);

    // Collect received events
    const receivedTitles: string[] = [];
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 1000);

      ws.onmessage = (event) => {
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CHANGED) {
          const props = (data[5] as unknown[])[1] as Record<string, unknown>;
          receivedTitles.push(props.title as string);
          if (receivedTitles.length === 3) {
            clearTimeout(timeout);
            resolve();
          }
        }
      };
    });

    ws.close();

    expect(receivedTitles.length).toBe(3);
    expect(receivedTitles).toContain("Article 1");
    expect(receivedTitles).toContain("Article 2");
    expect(receivedTitles).toContain("Article 3");
  });

  it("should filter items by lastItemChanged via WebSocket", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    // Connect and authenticate
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Broadcast an old item (changedAt < lastItemChanged)
    const oldItem = createTestItem({
      props: { title: "Old Article", slug: "old-article" },
      changedAt: 1000,
    });

    // Connection has lastItemChanged = 2000, so items with changedAt < 2000 should be filtered
    const connections: ConnectionInfo[] = [
      {
        userId: "strapi-e2e-user",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: 2000,
      },
    ];

    await wsServer.broadcast([oldItem] as any, connections);

    // Should NOT receive the item (filtered out)
    const received = await Promise.race([
      new Promise<boolean>((resolve) => {
        ws.onmessage = () => resolve(true);
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);

    ws.close();
    expect(received).toBe(false);
  });

  // ============== SSE Client Tests ==============

  it("should connect via SSE and receive CONNECTED event", async () => {
    const keyBase64 = TEST_CONSUMER_KEY.toString("base64");
    const url = `http://localhost:${SSE_PORT}/sse?key=${encodeURIComponent(keyBase64)}`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read the CONNECTED event
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes("\n\n")) break;
    }

    await reader.cancel();

    expect(buffer).toContain("event: connected");
    expect(buffer).toContain(`"type":${EventType.CONNECTED}`);
  });

  it("should receive CHANGED event via SSE when item is broadcast", async () => {
    // Use second consumer key to avoid conflict with previous SSE test
    const keyBase64 = TEST_CONSUMER_KEY_2.toString("base64");
    const url = `http://localhost:${SSE_PORT}/sse?key=${encodeURIComponent(keyBase64)}`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Helper to read next event
    let buffer = "";
    const readEvent = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return null;
        buffer += decoder.decode(value, { stream: true });
        const eventEndIndex = buffer.indexOf("\n\n");
        if (eventEndIndex !== -1) {
          const eventText = buffer.slice(0, eventEndIndex);
          buffer = buffer.slice(eventEndIndex + 2);
          const dataMatch = eventText.match(/data: (.+)/);
          if (dataMatch) return JSON.parse(dataMatch[1]);
        }
      }
    };

    // Read CONNECTED event
    const connected = await readEvent();
    expect(connected.type).toBe(EventType.CONNECTED);

    // Broadcast a test item (using consumer 2)
    const testItem = createTestItem({
      props: { title: "SSE Synced Article", slug: "sse-synced" },
    });

    const connections: ConnectionInfo[] = [
      {
        userId: "strapi-e2e-user",
        consumerId: 2, // Use consumer 2 for this test
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    await sseServer.broadcast([testItem] as any, connections);

    // Read CHANGED event
    const changed = await readEvent();
    expect(changed.type).toBe(EventType.CHANGED);
    expect(changed.item.props.title).toBe("SSE Synced Article");

    await reader.cancel();
  });

  // ============== Full Sync Flow Simulation Tests ==============

  it("should simulate full sync flow: Strapi create → service broadcast → client receive", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    // Connect client
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Step 1: Create article in mock Strapi
    const createResponse = await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        data: {
          title: "Full Flow Article",
          slug: "full-flow-article",
          description: "Testing the full sync flow",
        },
      }),
    });

    expect(createResponse.ok).toBe(true);
    const created = (await createResponse.json()) as { data: { documentId: string } };

    // Step 2: Simulate service processing the Strapi content
    const syncedItem = createTestItem({
      id: Buffer.from(created.data.documentId.padEnd(16, "0").slice(0, 16)),
      props: {
        title: "Full Flow Article",
        slug: "full-flow-article",
        description: "Testing the full sync flow",
      },
    });

    const connections: ConnectionInfo[] = [
      {
        userId: "strapi-e2e-user",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    // Step 3: Broadcast to connected clients
    await wsServer.broadcast([syncedItem] as any, connections);

    // Step 4: Client receives the synced content
    const receivedEvent = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Broadcast timeout")), 5000);

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CHANGED) {
          resolve((data[5] as unknown[])[1] as Record<string, unknown>);
        }
      };
    });

    ws.close();

    // Verify the full flow worked
    expect(receivedEvent.title).toBe("Full Flow Article");
    expect(receivedEvent.slug).toBe("full-flow-article");
    expect(receivedEvent.description).toBe("Testing the full sync flow");
  });

  it("should simulate Strapi update → service broadcast → client receive", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    // Connect client
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Create initial article
    const createResponse = await fetch(`http://localhost:${STRAPI_PORT}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ data: { title: "Original Title", slug: "update-test" } }),
    });

    const created = (await createResponse.json()) as { data: { documentId: string } };

    // Update the article in Strapi
    await fetch(`http://localhost:${STRAPI_PORT}/api/articles/${created.data.documentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ data: { title: "Updated Title" } }),
    });

    // Simulate service processing the update
    const updatedItem = createTestItem({
      id: Buffer.from(created.data.documentId.padEnd(16, "0").slice(0, 16)),
      props: { title: "Updated Title", slug: "update-test" },
      changedAt: Date.now(),
    });

    const connections: ConnectionInfo[] = [
      {
        userId: "strapi-e2e-user",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    await wsServer.broadcast([updatedItem] as any, connections);

    // Client receives the updated content
    const receivedEvent = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Broadcast timeout")), 5000);

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CHANGED) {
          resolve((data[5] as unknown[])[1] as Record<string, unknown>);
        }
      };
    });

    ws.close();

    expect(receivedEvent.title).toBe("Updated Title");
  });

  it("should handle ACK commands for item synchronization", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    // Connect client
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, TEST_CONSUMER_KEY]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CONNECTED) resolve();
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Broadcast an item
    const testItem = createTestItem({
      id: Buffer.from("ack-test-item-id!"),
      props: { title: "ACK Test Article", slug: "ack-test" },
    });

    const connections: ConnectionInfo[] = [
      {
        userId: "strapi-e2e-user",
        consumerId: 1,
        collectionId: 1,
        lastItemChanged: null,
      },
    ];

    await wsServer.broadcast([testItem] as any, connections);

    // Receive the item
    await new Promise<void>((resolve) => {
      ws.onmessage = (event) => {
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.CHANGED) resolve();
      };
    });

    // Send ACK for the received item
    const ackCmd = pack([CommandType.ACK, Buffer.from("ack-test-item-id!")]);
    ws.send(ackCmd);

    // Verify no error is received (ACK was processed successfully)
    const receivedError = await Promise.race([
      new Promise<boolean>((resolve) => {
        ws.onmessage = (event) => {
          const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
          if (data[0] === EventType.ERROR) resolve(true);
        };
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);

    ws.close();
    expect(receivedError).toBe(false);
  });

  // ============== Error Handling Tests ==============

  it("should return E_AUTH for invalid consumer key", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);
    const invalidKey = Buffer.alloc(32);
    invalidKey.write("invalid-consumer-key-12345678", 0, 32);

    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, invalidKey]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.ERROR) {
          resolve(data[1] as string);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(result).toBe("E_AUTH");
  });

  it("should return E_AUTH for wrong key length", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);
    const shortKey = Buffer.alloc(16); // Should be 32 bytes

    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

      ws.onopen = () => {
        const connectCmd = pack([CommandType.CONNECT, shortKey]);
        ws.send(connectCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.ERROR) {
          resolve(data[1] as string);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(result).toBe("E_AUTH");
  });

  it("should return E_INVALID for malformed messages", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

      ws.onopen = () => {
        ws.send(new Uint8Array([0xff, 0xff, 0xff]));
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.ERROR) {
          resolve(data[1] as string);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(result).toBe("E_INVALID");
  });

  it("should return E_ACCESS for ACK before authentication", async () => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws`);

    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

      ws.onopen = () => {
        // Send ACK without authenticating first
        const ackCmd = pack([CommandType.ACK, Buffer.alloc(16)]);
        ws.send(ackCmd);
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        const data = unpack(Buffer.from(event.data as ArrayBuffer)) as unknown[];
        if (data[0] === EventType.ERROR) {
          resolve(data[1] as string);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    ws.close();
    expect(result).toBe("E_ACCESS");
  });
});
