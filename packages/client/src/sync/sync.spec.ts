import { describe, expect, it, mock } from "bun:test";
import { Connection } from "../connections/connections";
import { NewPage } from "../core/db/schema";
import { PageData } from "../pages/data/page-data";
import { createPage, getPage, getPages } from "../pages/data/page-datasource";
import { Page } from "../pages/pages";
import { sync } from "./sync";

const conn = {
  id: 1,
  name: "foo",
  type: "foo",
  pullAllRefs: mock(async function* () {
    yield ["test"];
  }),
  pull: mock(async function* () {
    yield page;
  }),
} satisfies Connection;

describe("sync()", () => {
  it("should initially pull from a connection", async () => {
    const connections = [conn];

    sync(connections);
    await Bun.sleep(0);

    expect(conn.pull).toHaveBeenCalled();
  });

  it("should continuously pull from a connection", async () => {
    const conn2 = {
      ...conn,
      pull: mock(async function* () {
        yield page;
        yield { ...page, ref: "test2", slug: "test2" };
      }),
    } satisfies Connection;
    const connections = [conn2];

    sync(connections);
    await Bun.sleep(0);

    expect(conn.pull).toHaveBeenCalled();
  });

  it("should create pages in the database", async () => {
    const connections = [conn];

    sync(connections);
    await Bun.sleep(0);

    expect(conn.pull).toHaveBeenCalled();
    expect(await getPage({ ref: "test" })).toEqual({
      id: expect.any(Number),
      ...page,
    });
  });

  it("should remove orphans", async () => {
    await createPage({ ...page, ref: "test2", slug: "test2" });
    const connections = [conn];
    conn.pullAllRefs.mockImplementationOnce(async function* () {
      yield ["test2"];
    });

    sync(connections);
    await Bun.sleep(0);

    expect(await getPages()).toEqual([
      {
        id: expect.any(Number),
        ...page,
      },
    ]);
  });
});

const page = {
  ref: "test",
  slug: "test",
  collection: "foo",
  title: "abc",
  description: "test",
  content: [],
  attributes: {},
  connection: 1,
  publishedAt: 0,
  createdAt: 0,
  changedAt: 0,
  links: { content: [] },
} satisfies Omit<PageData<Page<{ collection: "foo" }>>, "id">;

const {
  links: {},
  ...pageWithoutLinks
} = page;

const newPage = {
  ...pageWithoutLinks,
  content: "[]",
  attributes: "{}",
  author: null,
  connection: 1,
  publishedAt: 0,
  createdAt: 0,
  updatedAt: null,
  changedAt: 0,
} satisfies NewPage;
