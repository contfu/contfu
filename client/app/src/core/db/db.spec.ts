import { describe, it } from "bun:test";
import { getDb } from "./db";

describe("tables", () => {
  it("should be present", async () => {
    await getDb().selectFrom("page").selectAll().execute();
  });
});
