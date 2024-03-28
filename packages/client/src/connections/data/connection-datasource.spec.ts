import { describe, expect, it } from "bun:test";
import { getDb, insertReturningId } from "../../core/db/db";
import type { NewConnection } from "../../core/db/schema";
import { ConnectionData } from "./connection-data";
import {
  createConnection,
  deleteConnection,
  getConnections,
  patchConnection,
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

describe("patchConnection()", () => {
  it("should update a connection", async () => {
    const id = await insertConnection();
    const updatedConnection = { ...connection, id, name: "test2" };

    await patchConnection(updatedConnection);

    expect(await selectAllConnections()).toEqual([updatedConnection]);
  });
});

describe("deleteConnection()", () => {
  it("should delete a connection", async () => {
    await insertConnection();

    await deleteConnection(connection);

    expect(await selectAllConnections()).toEqual([]);
  });
});

const connection = {
  name: "test",
  key: "test",
  target: "foo",
  type: "abc",
} satisfies Omit<ConnectionData, "id">;

const newConnection = {
  ...connection,
} satisfies NewConnection as any;

async function insertConnection(c: NewConnection = newConnection) {
  return await insertReturningId("connection", c);
}

async function selectAllConnections() {
  return await getDb().selectFrom("connection").selectAll().execute();
}
