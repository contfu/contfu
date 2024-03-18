import { describe, expect, it } from "bun:test";
import { NewConnection } from "../core/db/schema";
import { setConnections } from "./connections";
import { createConnection, getConnections } from "./data/connection-datasource";

describe("setConnections()", () => {
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

      const connections = await setConnections([connection, connection2]);

      expect(await getConnections()).toEqual(connections);
    });
  });

  describe("with stored connections", () => {
    it("should add another connection, if key or target differ", async () => {
      await createConnection(connection);
      const connection2 = { ...connection, key: "test2" };

      const connections = await setConnections([connection, connection2]);

      expect(await getConnections()).toEqual(connections);
    });

    it("should update a connection, if key and target equal", async () => {
      await createConnection(connection);
      const connection2 = { ...connection, name: "test2" };

      const connections = await setConnections([connection2]);

      expect(await getConnections()).toEqual(connections);
    });

    it("should delete a connection, if it is not in the passed connections", async () => {
      await createConnection(connection);

      await setConnections([]);

      expect(await getConnections()).toEqual([]);
    });
  });
});

const connection: NewConnection = {
  name: "test",
  key: "test",
  target: "foo",
  type: "abc",
};
