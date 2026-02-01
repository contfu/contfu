import { mock } from "bun:test";

// Mock client for Notion tests
export const mockClient = {
  databases: {
    retrieve: mock(),
  },
  dataSources: {
    query: mock(),
    retrieve: mock(),
  },
  blocks: {
    children: { list: mock() },
  },
  search: mock(),
};
