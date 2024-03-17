import { describe, expect, it } from "bun:test";
import { setConnections, type Connection } from "./connections";
import { createConnection, getConnections } from "./data/connection-datasource";

describe("setConnections()", () => {
  describe("with no stored connections", () => {
    it("should add a connection", async () => {
      await setConnections([connection]);

      expect(await getConnections()).toEqual([connection]);
    });

    it("should add another connection, if key or target differ", async () => {
      const connection2 = { ...connection, key: "test2" };

      await setConnections([connection, connection2]);

      expect(await getConnections()).toEqual([connection, connection2]);
    });
  });

  it("should throw an error, if key and target are the same", async () => {
    await createConnection(connection);

    expect(
      setConnections([connection, { ...connection, name: "test2" }])
    ).rejects.toThrow(/duplicate/i);
  });

  describe("with stored connections", () => {
    it("should add another connection, if key or target differ", async () => {
      await createConnection(connection);

      const connection2 = { ...connection, key: "test2" };

      await setConnections([connection, connection2]);

      expect(await getConnections()).toEqual([connection, connection2]);
    });

    it("should update a connection, if key and target equal", async () => {
      await createConnection(connection);

      const connection2 = { ...connection, name: "test2" };

      await setConnections([connection2]);

      expect(await getConnections()).toEqual([connection2]);
    });

    it("should delete a connection, if it is not in the passed connections", async () => {
      await createConnection(connection);

      await setConnections([]);

      expect(await getConnections()).toEqual([]);
    });
  });
});

const connection: Connection = {
  name: "test",
  key: "test",
  target: "foo",
  type: "abc",
};
