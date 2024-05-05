import { mock } from "bun:test";
import { iteratePaginatedAPI } from "notion-client-web-fetch";
import { mockClient } from "./mocks/notion";

mock.module("notion-client-web-fetch", () => ({
  iteratePaginatedAPI,
  Client: mock(() => mockClient),
}));
