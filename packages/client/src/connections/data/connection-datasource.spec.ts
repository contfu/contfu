import { describe, expect, it } from "bun:test";
import { getDb, insertReturningId } from "../../core/db/db";
import type { NewConnection } from "../../core/db/schema";
import { ConnectionData } from "./connection-data";
import {
  createConnection,
  deleteConnection,
  getConnections,
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

describe("deleteConnection()", () => {
  it("should delete a connection", async () => {
    await insertConnection();

    await deleteConnection(connection);

    expect(await selectAllConnections()).toEqual([]);
  });
});

const connection = {
  name: "test",
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
