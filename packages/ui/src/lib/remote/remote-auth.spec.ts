import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const originalFetch = globalThis.fetch;
process.env.CONTFU_BASIC_AUTH = "admin:secret";

const query = Object.assign(
  ((...args: [unknown] | [unknown, unknown]) => args.at(-1)) as (
    ...args: [unknown] | [unknown, unknown]
  ) => unknown,
  {
    batch: (_schema: unknown, handler: unknown) => handler,
  },
);

await mock.module("$app/server", () => ({ query }));

const { getCollectionsQuery, getCombinedCollectionTypesQuery, getCollectionDetailQuery } =
  await import("./collections.remote");
const { getItemsQuery, getItemByIdQuery, getItemFilesQuery } = await import("./items.remote");
const { getStats } = await import("./stats.remote");

function makeFetchResponse(path: string) {
  if (path === "/api/collections") return Response.json([{ name: "posts" }]);
  if (path === "/api/types") return new Response("type Post = {};");
  if (path.startsWith("/api/collections/posts")) {
    return Response.json({ collection: null, result: { data: [] }, typeString: null });
  }
  if (path.startsWith("/api/query-items")) return Response.json({ data: [] });
  if (path === "/api/items/item-1") return Response.json({ data: { props: {} } });
  if (path === "/api/items/item-1/files") return Response.json([]);
  if (path === "/api/status") {
    return Response.json({
      itemCount: 1,
      collectionCount: 2,
      fileCount: 3,
      downloadedCount: 4,
      processedCount: 5,
      sync: { state: "connected", reason: null },
    });
  }

  return Response.json({});
}

function makeBasicAuthHeader(value: string) {
  return `Basic ${Buffer.from(value).toString("base64")}`;
}

describe("remote modules use authenticated upstream fetch helper", () => {
  beforeEach(() => {
    process.env.SERVER_URL = "http://server:3001";
    globalThis.fetch = mock((url: string | URL | Request) => {
      const parsed = new URL(url.toString());
      return Promise.resolve(makeFetchResponse(`${parsed.pathname}${parsed.search}`));
    }) as typeof fetch;
  });

  afterAll(() => {
    delete process.env.SERVER_URL;
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  test("collections queries use authenticated server fetches", async () => {
    await getCollectionsQuery();
    await getCombinedCollectionTypesQuery();
    await getCollectionDetailQuery({
      name: "posts",
      input: { page: 2, pageSize: 25 },
    });

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "http://server:3001/api/collections",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "http://server:3001/api/types",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      "http://server:3001/api/collections/posts?page=2&pageSize=25",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  test("item queries use authenticated server fetches", async () => {
    await getItemsQuery({ collection: "posts", page: 1, pageSize: 20 });
    const getById = await getItemByIdQuery(["item-1"]);
    await getById("item-1");
    await getItemFilesQuery("item-1");

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "http://server:3001/api/query-items?collection=posts&page=1&pageSize=20",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "http://server:3001/api/items/item-1",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      "http://server:3001/api/items/item-1/files",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  test("stats queries use authenticated server fetches", async () => {
    await getStats();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://server:3001/api/status",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  test("server fetches attach upstream basic auth", async () => {
    await getStats();

    const init = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe(makeBasicAuthHeader("admin:secret"));
  });
});
