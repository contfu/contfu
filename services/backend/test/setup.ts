import { db, migrate, userTable } from "@contfu/db";
import { beforeEach, mock } from "bun:test";
import { iteratePaginatedAPI } from "notion-client-web-fetch";
import { mockClient } from "./mocks/notion";

Error.stackTraceLimit = Infinity;

await migrate("../../packages/db/migrations");

mock.module("notion-client-web-fetch", () => ({
  iteratePaginatedAPI,
  Client: mock(() => mockClient),
}));

beforeEach(async () => {
  await db.delete(userTable);
});
