/**
 * Mock Notion API server for E2E testing.
 * Responds to Notion API endpoints that the webhook handler calls.
 */

const MOCK_PAGE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MOCK_DATABASE_ID = "11111111-2222-3333-4444-555555555555";

const MOCK_PAGE_RESPONSE = {
  object: "page",
  id: MOCK_PAGE_ID,
  created_time: "2025-01-01T00:00:00.000Z",
  last_edited_time: "2025-01-02T00:00:00.000Z",
  created_by: { object: "user", id: "00000000-0000-0000-0000-000000000001" },
  last_edited_by: { object: "user", id: "00000000-0000-0000-0000-000000000001" },
  cover: null,
  icon: null,
  parent: { type: "database_id", database_id: MOCK_DATABASE_ID },
  archived: false,
  in_trash: false,
  properties: {
    Title: {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          text: { content: "Mock Page Title", link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          plain_text: "Mock Page Title",
          href: null,
        },
      ],
    },
    Status: {
      id: "status",
      type: "status",
      status: { id: "1", name: "Published", color: "green" },
    },
  },
  url: `https://www.notion.so/Mock-Page-Title-${MOCK_PAGE_ID.replace(/-/g, "")}`,
  public_url: null,
};

const server = Bun.serve({
  port: 4174,
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Health check for Playwright readiness detection
    if (path === "/" || path === "/index.html") {
      return new Response("OK");
    }

    // GET /v1/pages/:pageId
    if (req.method === "GET" && path.match(/^\/v1\/pages\/[^/]+$/)) {
      return Response.json(MOCK_PAGE_RESPONSE);
    }

    // GET /v1/blocks/:blockId/children
    if (req.method === "GET" && path.match(/^\/v1\/blocks\/[^/]+\/children$/)) {
      return Response.json({
        object: "list",
        results: [],
        has_more: false,
        next_cursor: null,
        type: "block",
        block: {},
      });
    }

    // Catch-all: return 404
    console.log(`[Mock Notion] Unhandled: ${req.method} ${path}`);
    return Response.json({ object: "error", status: 404, message: "Not found" }, { status: 404 });
  },
});

console.log(`Mock Notion server ready on port ${server.port}`);
