import { describe, expect, it } from "bun:test";
import { PageData } from "../../pages/data/page-data";
import {
  createPage,
  createPageLink,
  getPageLinks,
  getPages,
} from "../../pages/data/page-datasource";
import { Page } from "../../pages/pages";
import { Connection } from "../connections";
import { ConnectionData } from "./connection-data";
import { createConnection, getConnections } from "./connection-datasource";
import { updateConnections } from "./connection-repository";

describe("updateConnections()", () => {
  it("should throw an error, name is the same", async () => {
    expect(
      updateConnections([{ ...connection }, { ...connection }])
    ).rejects.toThrow(/constraint/i);
  });

  it("should rollback transaction, if something goes wrong", async () => {
    try {
      await updateConnections([{ ...connection }, { ...connection }]);
    } catch (e) {}

    expect(await getConnections()).toEqual([]);
  });
  describe("with no stored connections", () => {
    it("should add a connection", async () => {
      await updateConnections([{ ...connection }]);

      expect(await getConnections()).toEqual([
        { ...newConnection, id: expect.any(Number) },
      ]);
    });

    it("should add another connection, if name differs", async () => {
      const connection2 = { ...connection, name: "test2" };

      await updateConnections([{ ...connection }, connection2]);

      expect(await getConnections()).toEqual([
        expect.objectContaining({
          ...newConnection,
          id: expect.any(Number),
        }),
        expect.objectContaining({
          ...newConnection,
          name: "test2",
          id: expect.any(Number),
        }),
      ]);
    });
  });

  describe("with stored connections", () => {
    it("should add another connection, if name differs", async () => {
      await createConnection(newConnection);
      const connection2 = { ...connection, name: "test2" };

      await updateConnections([{ ...connection }, connection2]);

      expect(await getConnections()).toEqual([
        expect.objectContaining({
          ...newConnection,
          id: expect.any(Number),
        }),
        expect.objectContaining({
          ...newConnection,
          name: "test2",
          id: expect.any(Number),
        }),
      ]);
    });

    it("should update a connection, if name equals", async () => {
      await createConnection(newConnection);
      const connection2 = { ...connection, name: "test2" };

      await updateConnections([{ ...connection2 }]);

      expect(await getConnections()).toEqual([
        expect.objectContaining({
          ...newConnection,
          name: "test2",
          id: expect.any(Number),
        }),
      ]);
    });

    it("should delete a connection with related pages and links, if it is not in the passed connections", async () => {
      await createConnection(newConnection);
      const { id: pageId } = await createPage({ ...page, collection: "test" });
      await createPageLink({ type: "foo", from: 1, to: 1 });

      await updateConnections([]);

      expect(await getConnections()).toEqual([]);
      expect(await getPages()).toEqual([]);
      expect(await getPageLinks({ from: pageId })).toEqual({ content: [] });
    });
  });
});

const newConnection: Omit<ConnectionData, "id"> = {
  name: "test",
};

const connection = {
  ...newConnection,
  collectionNames: ["foo"],
  async *pull() {},
  async *pullCollectionRefs() {},
} as Omit<Connection, "id"> as Connection;

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
