import { beforeEach, mock } from "bun:test";
import { iteratePaginatedAPI } from "notion-client-web-fetch";
import { user } from "../src/access/db/access-schema";
import { db } from "../src/core/db/db";
import { mockClient } from "./mocks/notion";

mock.module("notion-client-web-fetch", () => ({
  iteratePaginatedAPI,
  Client: mock(() => mockClient),
}));

beforeEach(async () => {
  await db.delete(user);
});
