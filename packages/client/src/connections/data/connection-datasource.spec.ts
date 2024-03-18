import { describe, expect, it } from "bun:test";
import { getDb, getInsertId } from "../../core/db/db";
import type { NewConnection } from "../../core/db/schema";
import {
  createConnection,
  deleteConnection,
  getConnections,
  updateConnection,
} from "./connection-datasource";

describe("getConnections()", () => {
  it("should return an array of connections", async () => {
    const id = await insertConnection();

    const connections = await getConnections();

    expect(connections).toEqual([{ ...connection, id }]);
  });
});

describe("createConnection()", () => {
  it("should insert a new connection", async () => {
    const { id } = await createConnection(connection);

    expect(await selectAllConnections()).toEqual([{ ...connection, id }]);
  });
});

describe("updateConnection()", () => {
  it("should update a connection", async () => {
    const id = await insertConnection();
    const updatedConnection = { ...connection, id, name: "test2" };

    await updateConnection(updatedConnection);

    expect(await selectAllConnections()).toEqual([updatedConnection]);
  });
});

describe("deleteConnection()", () => {
  it("should delete a connection", async () => {
    const id = await insertConnection();

    await deleteConnection(connection);

    expect(await selectAllConnections()).toEqual([]);
  });
});

const connection: NewConnection = {
  name: "test",
  key: "test",
  target: "foo",
  type: "abc",
};

async function insertConnection(c: NewConnection = connection) {
  await getDb().insertInto("connection").values(c).execute();
  return await getInsertId();
}

async function selectAllConnections() {
  return await getDb().selectFrom("connection").selectAll().execute();
}
