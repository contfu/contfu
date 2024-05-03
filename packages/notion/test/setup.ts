import { setup, truncate } from "@contfu/client";
import { beforeAll, beforeEach, mock } from "bun:test";
import { BunWorkerDialect } from "kysely-bun-worker";
import { iteratePaginatedAPI } from "notion-client-web-fetch";
import { mockClient } from "./mocks/notion";

mock.module("notion-client-web-fetch", () => ({
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
