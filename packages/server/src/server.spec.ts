import { afterEach, describe, expect, mock, test } from "bun:test";
import { createServeOptions } from "./server";

async function callRoute(
  route: (request: Request) => Response | Promise<Response>,
  request: Request & { params?: Record<string, string> },
) {
  return route(request);
}

async function readText(response: Response) {
  return response.text();
}

describe("@contfu/server routes", () => {
  afterEach(() => {
    mock.restore();
  });

  test("parses item query params and forwards them to findItems", async () => {
    const findItems = mock((options: Record<string, unknown>) => ({ data: options }));

    await mock.module("@contfu/contfu", () => ({
      connect: mock(async function* () {}),
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
      with: JSON.stringify({ relation: true }),
    }).toString();

    const response = await callRoute(routes["/api/items"], new Request(url));

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
      with: { relation: true },
    });
  });

  test("rejects invalid item limit values", async () => {
    await mock.module("@contfu/contfu", () => ({
      connect: mock(async function* () {}),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/items?limit=foo");
    const response = await callRoute(routes["/api/items"], new Request(url));

    expect(response.status).toBe(400);
    expect(await readText(response)).toBe("Invalid 'limit' parameter");
  });

  test("rejects invalid collection offsets", async () => {
    await mock.module("@contfu/contfu", () => ({
      connect: mock(async function* () {}),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/collections/articles/items?offset=bar");
    const request = Object.assign(new Request(url), {
      params: { name: "articles" },
    });
    const response = await callRoute(routes["/api/collections/:name/items"], request);

    expect(response.status).toBe(400);
    expect(await readText(response)).toBe("Invalid 'offset' parameter");
  });

  test("rejects invalid with clauses on collection queries", async () => {
    await mock.module("@contfu/contfu", () => ({
      connect: mock(async function* () {}),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/collections/articles/items?with=not-json");
    const request = Object.assign(new Request(url), {
      params: { name: "articles" },
    });
    const response = await callRoute(routes["/api/collections/:name/items"], request);

    expect(response.status).toBe(400);
    expect(await readText(response)).toBe("Invalid 'with' parameter");
  });

  test("rejects invalid with clauses on item lookups", async () => {
    const getItemById = mock(() => ({ id: "article-1" }));

    await mock.module("@contfu/contfu", () => ({
      connect: mock(async function* () {}),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById,
    }));

    const { routes } = createServeOptions();
    const url = new URL("http://localhost/api/items/article-1?with=not-json");
    const request = Object.assign(new Request(url), {
      params: { id: "article-1" },
    });
    const response = await callRoute(routes["/api/items/:id"], request);

    expect(response.status).toBe(400);
    expect(await readText(response)).toBe("Invalid 'with' parameter");
    expect(getItemById).not.toHaveBeenCalled();
  });

  test("returns an item by id with parsed include and with clauses", async () => {
    const getItemById = mock((id: string, options: Record<string, unknown>) => ({
      id,
      options,
    }));

    await mock.module("@contfu/contfu", () => ({
      connect: mock(async function* () {}),
      findItems: mock(() => ({ data: [] })),
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById,
    }));

    const { routes } = createServeOptions();
    const url = new URL(
      "http://localhost/api/items/article-1?include=files,author&with=%7B%22relation%22%3Atrue%7D",
    );
    const request = Object.assign(new Request(url), {
      params: { id: "article-1" },
    });
    const response = await callRoute(routes["/api/items/:id"], request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        id: "article-1",
        options: {
          include: ["files", "author"],
          with: { relation: true },
        },
      },
    });
    expect(getItemById).toHaveBeenCalledWith("article-1", {
      include: ["files", "author"],
      with: { relation: true },
    });
  });

  test("adds the collection filter before forwarding collection queries", async () => {
    const findItems = mock((options: Record<string, unknown>) => ({ data: options }));

    await mock.module("@contfu/contfu", () => ({
      connect: mock(async function* () {}),
      findItems,
      generateTypes: mock(() => ""),
      getAllCollectionSchemas: mock(() => []),
      getItemById: mock(() => null),
    }));

    const { routes } = createServeOptions();
    const url = new URL(
      "http://localhost/api/collections/articles/items?filter=published%20%3D%20true",
    );
    const request = Object.assign(new Request(url), {
      params: { name: "articles" },
    });
    const response = await callRoute(routes["/api/collections/:name/items"], request);

    expect(response.status).toBe(200);
    expect(findItems).toHaveBeenCalledWith({
      filter: '$collection = "articles" && (published = true)',
    });
  });
});
