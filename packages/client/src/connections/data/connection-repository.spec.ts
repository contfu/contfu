import { describe, expect, it } from "bun:test";
import { Connection, setConnections } from "../connections";
import { ConnectionData } from "./connection-data";
import { createConnection, getConnections } from "./connection-datasource";

describe("updateConnections()", () => {
  it("should throw an error, if key and target are the same", async () => {
    expect(
      setConnections([connection, { ...connection, name: "test2" }])
    ).rejects.toThrow(/constraint/i);
  });

  it("should rollback transaction, if something goes wrong", async () => {
    try {
      await setConnections([connection, connection]);
    } catch (e) {}

    expect(await getConnections()).toEqual([]);
  });
  describe("with no stored connections", () => {
    it("should add a connection", async () => {
      await setConnections([connection]);

      expect(await getConnections()).toEqual([
        { ...connection, id: expect.any(Number) },
      ]);
    });

    it("should add another connection, if key or target differ", async () => {
      const connection2 = { ...connection, key: "test2" };

      await setConnections([connection, connection2]);

      expect(await getConnections()).toEqual([
        expect.objectContaining({
          ...newConnection,
          id: expect.any(Number),
        }),
        expect.objectContaining({
          ...newConnection,
          key: "test2",
          id: expect.any(Number),
        }),
      ]);
    });
  });

  describe("with stored connections", () => {
    it("should add another connection, if key or target differ", async () => {
      await createConnection(connection);
      const connection2 = { ...connection, key: "test2" };

      await setConnections([connection, connection2]);

      expect(await getConnections()).toEqual([
        expect.objectContaining({
          ...newConnection,
          id: expect.any(Number),
        }),
        expect.objectContaining({
          ...newConnection,
          key: "test2",
          id: expect.any(Number),
        }),
      ]);
    });

    it("should update a connection, if key and target equal", async () => {
      await createConnection(connection);
      const connection2 = { ...connection, name: "test2" };

      await setConnections([connection2]);

      expect(await getConnections()).toEqual([
        expect.objectContaining({
          ...newConnection,
          key: "test2",
          id: expect.any(Number),
        }),
      ]);
    });

    it("should delete a connection, if it is not in the passed connections", async () => {
      await createConnection(connection);

      await setConnections([]);

      expect(await getConnections()).toEqual([]);
    });
  });
});

const newConnection: Omit<ConnectionData, "id"> = {
  name: "test",
  key: "test",
  target: "foo",
  type: "abc",
};

const connection: Connection = {
  ...newConnection,
  getCollectionRefs: async () => {},
  pull: async () => {},
  pullRecent: async () => {},
};
