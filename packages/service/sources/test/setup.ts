import { mock } from "bun:test";
import {
  isFullBlock,
  isFullDatabase,
  isFullDataSource,
  isFullPage,
  iteratePaginatedAPI,
} from "@notionhq/client";
import { mockClient } from "../src/notion/__tests__/notion-mock-setup";

Error.stackTraceLimit = Infinity;

// Mock @notionhq/client module with real helpers
await mock.module("@notionhq/client", () => ({
  isFullPage,
  isFullBlock,
  isFullDatabase,
  isFullDataSource,
  iteratePaginatedAPI,
  Client: class MockClient {
    databases = mockClient.databases;
    dataSources = mockClient.dataSources;
    pages = mockClient.pages;
    blocks = mockClient.blocks;
    search = mockClient.search;
  },
}));
