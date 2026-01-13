import { beforeEach, mock } from "bun:test";
import { iteratePaginatedAPI } from "notion-client-web-fetch";
import { db, userTable } from "../src/db/db";
import { mockClient } from "./mocks/notion";

Error.stackTraceLimit = Infinity;

mock.module("notion-client-web-fetch", () => ({
  iteratePaginatedAPI,
  Client: mock(() => mockClient),
}));

beforeEach(async () => {
  await db.delete(userTable);
});
