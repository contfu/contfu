import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import * as contfuModule from "@contfu/contfu";
import { checkBasicAuth } from "./basic-auth";
import { createServeOptions } from "./server";

const originalContfuModule = { ...contfuModule };

type TestRoute = (request: Request) => Response | Promise<Response>;
type ServeRoutes = NonNullable<ReturnType<typeof createServeOptions>["routes"]>;

function getRoute(routes: ServeRoutes | undefined, path: keyof ServeRoutes): TestRoute {
  const route = routes?.[path];
  if (typeof route !== "function") throw new Error(`Route ${path} is not registered`);
  return route as TestRoute;
}

async function callRoute(route: TestRoute, request: Request & { params?: Record<string, string> }) {
  return route(request);
}

async function readText(response: Response) {
  return response.text();
}

function makeBasicAuthHeader(value: string) {
  return `Basic ${Buffer.from(value).toString("base64")}`;
}

describe("@contfu/server routes", () => {
  afterEach(() => {
    delete process.env.CONTFU_BASIC_AUTH;
    delete process.env.CONTFU_DEFAULT_LOCALE;
    delete process.env.CONTFU_FALLBACK_LOCALE;
    mock.restore();
  });

  afterAll(async () => {
    await mock.module("@contfu/contfu", () => originalContfuModule);
    mock.restore();
  });

  test("returns server status", async () => {
    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      countCollections: mock(() => 2),
      countDownloadedFiles: mock(() => 3),
      countFiles: mock(() => 4),
      countItems: mock(() => 5),
      countProcessedFiles: mock(() => 1),
      findItems: mock(() => ({ data: [] })),
      getItemById: mock(() => null),
      getTypeGenerationInputs: mock(() => []),
    }));

    const { routes } = createServeOptions();
    const response = await callRoute(
      getRoute(routes, "/api/status"),
      new Request("http://localhost/api/status"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      itemCount: 5,
      collectionCount: 2,
      fileCount: 4,
      downloadedCount: 3,
      processedCount: 1,
      sync: { state: "disabled", reason: null },
    });
  });

  test("leaves routes unprotected when basic auth is not configured", async () => {
    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      countCollections: mock(() => 2),
      countDownloadedFiles: mock(() => 3),
      countFiles: mock(() => 4),
      countItems: mock(() => 5),
      countProcessedFiles: mock(() => 1),
      findItems: mock(() => ({ data: [] })),
      getItemById: mock(() => null),
      getTypeGenerationInputs: mock(() => []),
    }));

    const { routes } = createServeOptions();
    const response = await callRoute(
      getRoute(routes, "/api/status"),
      new Request("http://localhost/api/status"),
    );

    expect(response.status).toBe(200);
  });

  test("rejects non-GET requests on registered routes", async () => {
    const countItems = mock(() => 5);

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      countCollections: mock(() => 2),
      countDownloadedFiles: mock(() => 3),
      countFiles: mock(() => 4),
      countItems,
      countProcessedFiles: mock(() => 1),
      findItems: mock(() => ({ data: [] })),
      getItemById: mock(() => null),
      getTypeGenerationInputs: mock(() => []),
    }));

    const { routes } = createServeOptions();
    const response = await callRoute(
      getRoute(routes, "/api/status"),
      new Request("http://localhost/api/status", { method: "POST" }),
    );

    expect(response.status).toBe(405);
    expect(await readText(response)).toBe("Method not allowed");
    expect(countItems).not.toHaveBeenCalled();
  });

  test("rejects protected requests without valid basic auth", async () => {
    const response = checkBasicAuth(new Request("http://localhost/api/status"), "admin:secret");

    expect(response?.status).toBe(401);
    expect(response?.headers.get("WWW-Authenticate")).toBe('Basic realm="Contfu"');
    expect(await readText(response!)).toBe("Unauthorized");
  });

  test("rejects protected requests with invalid basic auth", () => {
    const response = checkBasicAuth(
      new Request("http://localhost/api/status", {
        headers: { authorization: makeBasicAuthHeader("admin:nope") },
      }),
      "admin:secret",
    );

    expect(response?.status).toBe(401);
    expect(response?.headers.get("WWW-Authenticate")).toBe('Basic realm="Contfu"');
  });

  test("allows protected requests with valid basic auth", () => {
    const response = checkBasicAuth(
      new Request("http://localhost/api/status", {
        headers: { authorization: makeBasicAuthHeader("admin:secret") },
      }),
      "admin:secret",
    );

    expect(response).toBeNull();
  });

  test("parses item query params and forwards them to findItems", async () => {
    const findItems = mock((options: Record<string, unknown>) => ({ data: options }));

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems,
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/items");
    url.search = new URLSearchParams({
      filter: 'title ~ "Post"',
      search: "alpha",
      sort: "$changedAt,-title",
      limit: "5",
      offset: "2",
      include: "files,author",
      fields: "title,slug",
      flat: "true",
      plainDatesAs: "milliseconds",
      includeDeleted: "true",
      onlyDeleted: "true",
      with: JSON.stringify({ relation: true }),
    }).toString();

    const response = await callRoute(getRoute(routes, "/api/items"), new Request(url.href));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        filter: 'title ~ "Post"',
        search: "alpha",
        sort: ["$changedAt", "-title"],
        limit: 5,
        offset: 2,
        include: ["files", "author"],
        fields: ["title", "slug"],
        flat: true,
        plainDatesAs: "milliseconds",
        includeDeleted: true,
        onlyDeleted: true,
        with: { relation: true },
      },
    });
    expect(findItems).toHaveBeenCalledWith({
      filter: 'title ~ "Post"',
      search: "alpha",
      sort: ["$changedAt", "-title"],
      limit: 5,
      offset: 2,
      include: ["files", "author"],
      fields: ["title", "slug"],
      flat: true,
      plainDatesAs: "milliseconds",
      includeDeleted: true,
      onlyDeleted: true,
      with: { relation: true },
    });
  });

  test("rejects invalid item limit values", async () => {
    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/items?limit=foo");
    const response = await callRoute(getRoute(routes, "/api/items"), new Request(url.href));

    expect(response.status).toBe(400);
    expect(await readText(response)).toBe("Invalid 'limit' parameter");
  });

  test("rejects invalid collection offsets", async () => {
    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/collections/articles/items?offset=bar");
    const request = Object.assign(new Request(url.href), {
      params: { name: "articles" },
    });
    const response = await callRoute(getRoute(routes, "/api/collections/:name/items"), request);

    expect(response.status).toBe(400);
    expect(await readText(response)).toBe("Invalid 'offset' parameter");
  });

  test("rejects invalid with clauses on collection queries", async () => {
    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/collections/articles/items?with=not-json");
    const request = Object.assign(new Request(url.href), {
      params: { name: "articles" },
    });
    const response = await callRoute(getRoute(routes, "/api/collections/:name/items"), request);

    expect(response.status).toBe(400);
    expect(await readText(response)).toBe("Invalid 'with' parameter");
  });

  test("rejects invalid with clauses on item lookups", async () => {
    const getItemById = mock(() => ({ id: 1 }));

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById,
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/items/1?with=not-json");
    const request = Object.assign(new Request(url.href), {
      params: { id: "1" },
    });
    const response = await callRoute(getRoute(routes, "/api/items/:id"), request);

    expect(response.status).toBe(400);
    expect(await readText(response)).toBe("Invalid 'with' parameter");
    expect(getItemById).not.toHaveBeenCalled();
  });

  test("returns an item by id with parsed include and with clauses", async () => {
    const getItemById = mock((id: number, options: Record<string, unknown>) => ({
      id,
      options,
    }));

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById,
    }));

    const { routes } = createServeOptions();
    const url = new URL(
      "http://localhost/api/items/1?include=files,author&with=%7B%22relation%22%3Atrue%7D&plainDatesAs=milliseconds",
    );
    const request = Object.assign(new Request(url.href), {
      params: { id: "1" },
    });
    const response = await callRoute(getRoute(routes, "/api/items/:id"), request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        id: 1,
        options: {
          include: ["files", "author"],
          with: { relation: true },
          plainDatesAs: "milliseconds",
        },
      },
    });
    expect(getItemById).toHaveBeenCalledWith(1, {
      include: ["files", "author"],
      with: { relation: true },
      plainDatesAs: "milliseconds",
    });
  });

  test("applies i18n defaults only when omitted on query endpoints", async () => {
    const findItems = mock((options: Record<string, unknown>) => ({ data: options }));
    const getItemById = mock((id: number, options: Record<string, unknown>) => ({ id, options }));

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems,
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById,
    }));

    process.env.CONTFU_DEFAULT_LOCALE = "en";
    process.env.CONTFU_FALLBACK_LOCALE = "true";
    const { routes } = createServeOptions({ i18n: { defaultLocale: "de", fallback: "fr" } });

    await callRoute(getRoute(routes, "/api/items"), new Request("http://localhost/api/items"));
    expect(findItems).toHaveBeenLastCalledWith({ locale: "de", fallback: "fr" }, undefined, {
      defaultLocale: "de",
      fallback: "fr",
    });

    await callRoute(
      getRoute(routes, "/api/items"),
      new Request("http://localhost/api/items?locale=false&fallback=false"),
    );
    expect(findItems).toHaveBeenLastCalledWith({ locale: false, fallback: false }, undefined, {
      defaultLocale: "de",
      fallback: "fr",
    });

    const itemRequest = Object.assign(new Request("http://localhost/api/items/1"), {
      params: { id: "1" },
    });
    await callRoute(getRoute(routes, "/api/items/:id"), itemRequest);
    expect(getItemById).toHaveBeenLastCalledWith(1, {});
  });

  test("uses env i18n defaults when code config is absent", async () => {
    const findItems = mock((options: Record<string, unknown>) => ({ data: options }));

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems,
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    process.env.CONTFU_DEFAULT_LOCALE = "en";
    process.env.CONTFU_FALLBACK_LOCALE = "false";
    const { routes } = createServeOptions();

    await callRoute(getRoute(routes, "/api/items"), new Request("http://localhost/api/items"));
    expect(findItems).toHaveBeenLastCalledWith({ locale: "en", fallback: false }, undefined, {
      defaultLocale: "en",
      fallback: false,
    });
  });

  test("ignores unresolved server fallback true defaults", async () => {
    const findItems = mock((options: Record<string, unknown>) => ({ data: options }));

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems,
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    process.env.CONTFU_FALLBACK_LOCALE = "true";
    const { routes } = createServeOptions();

    await callRoute(getRoute(routes, "/api/items"), new Request("http://localhost/api/items"));
    expect(findItems).toHaveBeenLastCalledWith({}, undefined, {
      defaultLocale: undefined,
      fallback: true,
    });
  });

  test("passes server i18n config so fallback true can resolve through default locale", async () => {
    const findItems = mock(
      (options: Record<string, unknown>, _ctx: unknown, i18n?: Record<string, unknown>) => {
        if (options.fallback === true && i18n?.defaultLocale !== "en") {
          throw new Error("fallback=true requires server i18n defaultLocale");
        }
        return { data: options };
      },
    );

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems,
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions({ i18n: { defaultLocale: "en", fallback: false } });

    const response = await callRoute(
      getRoute(routes, "/api/items"),
      new Request("http://localhost/api/items?fallback=true"),
    );

    expect(response.status).toBe(200);
    expect(findItems).toHaveBeenLastCalledWith({ locale: "en", fallback: true }, undefined, {
      defaultLocale: "en",
      fallback: false,
    });
  });

  test("adds the collection filter before forwarding collection queries", async () => {
    const findItems = mock((options: Record<string, unknown>) => ({ data: options }));

    await mock.module("@contfu/contfu", () => ({
      contfu: mock(() => ({
        events: (async function* () {})(),
        handleFileRequest: mock(() => new Response("")),
      })),
      getFileStore: mock(() => ({})),
      getMediaOptimizer: mock(() => ({})),
      findItems,
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL(
      "http://localhost/api/collections/articles/items?filter=published%20%3D%20true",
    );
    const request = Object.assign(new Request(url.href), {
      params: { name: "articles" },
    });
    const response = await callRoute(getRoute(routes, "/api/collections/:name/items"), request);

    expect(response.status).toBe(200);
    expect(findItems).toHaveBeenCalledWith({
      filter: '$collection = "articles" && (published = true)',
    });
  });
});
