import { mock } from "bun:test";
import { isFullBlock, isFullPage, iteratePaginatedAPI } from "@notionhq/client";
import { mockClient } from "../src/sources/notion/__tests__/notion-mock-setup";

Error.stackTraceLimit = Infinity;

// Mock @notionhq/client module with real helpers
mock.module("@notionhq/client", () => ({
  isFullPage,
  isFullBlock,
  iteratePaginatedAPI,
  Client: class MockClient {
    databases = mockClient.databases;
    dataSources = mockClient.dataSources;
    blocks = mockClient.blocks;
  },
}));
