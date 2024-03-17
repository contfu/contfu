import { describe, expect, it } from "bun:test";
import { getDb } from "../../core/db/db";
import type { DbConnection } from "../../core/db/schema";
import {
  createConnection,
  deleteConnection,
  getConnections,
  updateConnection,
} from "./connection-datasource";

describe("getConnections()", () => {
  it("should return an array of connections", async () => {
    await getDb().insertInto("connection").values(connection).execute();

    const connections = await getConnections();

    expect(connections).toEqual([connection]);
  });
});

describe("createConnection()", () => {
  it("should insert a new connection", async () => {
    await createConnection(connection);

    const connections = await getDb()
      .selectFrom("connection")
      .selectAll()
      .execute();
    expect(connections).toEqual([connection]);
  });
});

describe("updateConnection()", () => {
  it("should update a connection", async () => {
    await getDb().insertInto("connection").values(connection).execute();
    const updatedConnection = { ...connection, name: "test2" };

    await updateConnection(updatedConnection);

    const stored = await getDb()
      .selectFrom("connection")
      .selectAll()
      .executeTakeFirst();
    expect(stored).toEqual(updatedConnection);
  });
});

describe("deleteConnection()", () => {
  it("should delete a connection", async () => {
    await getDb().insertInto("connection").values(connection).execute();

    await deleteConnection(connection);

    const stored = await getDb().selectFrom("connection").selectAll().execute();
    expect(stored).toEqual([]);
  });
});

const connection: DbConnection = {
  name: "test",
  key: "test",
  target: "foo",
  type: "abc",
};
