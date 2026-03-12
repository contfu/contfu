/**
 * Mock Notion API server for E2E testing.
 * Responds to Notion API endpoints that the webhook handler calls.
 */

const MOCK_PAGE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MOCK_DATABASE_ID = "11111111-2222-3333-4444-555555555555";
const MOCK_DATA_SOURCE_ID = "ffffffff-aaaa-bbbb-cccc-111111111111";

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

const MOCK_DATA_SOURCE_RESPONSE = {
  object: "database",
  id: MOCK_DATA_SOURCE_ID,
  parent: { type: "database_id", database_id: MOCK_DATABASE_ID },
  properties: {
    Title: { id: "title", type: "title", title: {} },
  },
};

// Schema-sync test: data source IDs and their responses
// Must match schema-sync.seed.ts constants
const SCHEMA_SYNC_DB_ID = "22222222-3333-4444-5555-666666666666";
const SCHEMA_BREAK_DS_ID = "ffffffff-bbbb-cccc-dddd-111111111111";
const SCHEMA_FIX_DS_ID = "ffffffff-bbbb-cccc-dddd-222222222222";

/** Breaking schema — only Title, no Status. Filter on "status" will be invalid. */
const SCHEMA_BREAK_RESPONSE = {
  object: "database",
  id: SCHEMA_BREAK_DS_ID,
  parent: { type: "database_id", database_id: SCHEMA_SYNC_DB_ID },
  properties: {
    Title: { id: "title", type: "title", title: {} },
  },
};

/** Compatible schema — has both Title and Status. Filter on "status" is valid. */
const SCHEMA_FIX_RESPONSE = {
  object: "database",
  id: SCHEMA_FIX_DS_ID,
  parent: { type: "database_id", database_id: SCHEMA_SYNC_DB_ID },
  properties: {
    Title: { id: "title", type: "title", title: {} },
    Status: { id: "status", type: "status", status: {} },
  },
};

const DATA_SOURCE_RESPONSES: Record<string, object> = {
  [SCHEMA_BREAK_DS_ID]: SCHEMA_BREAK_RESPONSE,
  [SCHEMA_FIX_DS_ID]: SCHEMA_FIX_RESPONSE,
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

    // GET /v1/data-sources/:dataSourceId
    if (req.method === "GET" && path.match(/^\/v1\/data-sources\/[^/]+$/)) {
      const dsId = path.split("/").pop()!;
      const specific = DATA_SOURCE_RESPONSES[dsId];
      return Response.json(specific ?? MOCK_DATA_SOURCE_RESPONSE);
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
