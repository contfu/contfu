/**
 * Mock Strapi v4 API server for E2E testing.
 * Responds to paginated content-type endpoints used by the Strapi source adapter.
 */

const MOCK_ARTICLES = [
  {
    id: 1,
    documentId: "doc-a-1",
    title: "Article One",
    views: 42,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    publishedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    documentId: "doc-a-2",
    title: "Article Two",
    views: "not-a-number",
    createdAt: "2025-01-02T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
    publishedAt: "2025-01-02T00:00:00.000Z",
  },
];

const MOCK_POSTS = [
  {
    id: 1,
    documentId: "doc-b-1",
    heading: "Post Alpha",
    rating: 5,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    publishedAt: "2025-01-01T00:00:00.000Z",
  },
];

function makeResponse(data: unknown[]) {
  return Response.json({
    data,
    meta: {
      pagination: {
        page: 1,
        pageSize: 25,
        pageCount: 1,
        total: data.length,
      },
    },
  });
}

const server = Bun.serve({
  port: 4175,
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Health check for Playwright readiness detection
    if (path === "/" || path === "/index.html") {
      return new Response("OK");
    }

    // GET /api/articles — Strapi v4 plural endpoint
    if (req.method === "GET" && path === "/api/articles") {
      return makeResponse(MOCK_ARTICLES);
    }

    // GET /api/posts — Strapi v4 plural endpoint
    if (req.method === "GET" && path === "/api/posts") {
      return makeResponse(MOCK_POSTS);
    }

    console.log(`[Mock Strapi] Unhandled: ${req.method} ${path}`);
    return Response.json({ error: { status: 404, message: "Not found" } }, { status: 404 });
  },
});

console.log(`Mock Strapi server ready on port ${server.port}`);
