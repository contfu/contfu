import { setup, truncate } from "@contfu/client";
import { iteratePaginatedAPI } from "@notionhq/client";
import { beforeAll, beforeEach, mock } from "bun:test";
import { BunWorkerDialect } from "kysely-bun-worker";
import { mockClient } from "./mocks/notion";

mock.module("@notionhq/client", () => ({
  iteratePaginatedAPI,
  Client: mock(() => mockClient),
}));

beforeAll(async () => {
  const kyselyDialect = new BunWorkerDialect();
  await setup({ kyselyDialect });
});

beforeEach(async () => {
  await truncate();
});
