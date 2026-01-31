import { mock } from "bun:test";

// Mock client for Notion tests
export const mockClient = {
  databases: {
    retrieve: mock(),
  },
  dataSources: {
    query: mock(),
  },
  blocks: {
    children: { list: mock() },
  },
};
