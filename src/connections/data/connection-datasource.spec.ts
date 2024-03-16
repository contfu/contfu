import { describe, expect, it } from "bun:test";
import { getDb } from "../../core/db/db";
import { getConnections } from "./connection-datasource";

describe("getConnections()", () => {
  it("should return an array of connections", async () => {
    const connection = {
      name: "test",
      key: "test",
      target: "foo",
      type: "abc",
    };
    await getDb().insertInto("connection").values(connection).execute();

    const connections = await getConnections();

    expect(connections).toEqual([connection]);
  });
});
