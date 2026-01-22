import { mock } from "bun:test";
import type { Client } from "notion-client-web-fetch";
import { DeepPartial } from "ts-essentials";

// Shared mock client instance - used across all Notion test files
export const mockClient = {
  databases: { query: mock(), retrieve: mock() },
  blocks: { children: { list: mock() } },
} satisfies DeepPartial<Client>;

// Mock the notion-client-web-fetch module with a custom iteratePaginatedAPI implementation
mock.module("notion-client-web-fetch", () => ({
  iteratePaginatedAPI: async function* <T>(
    listFn: (params: Record<string, unknown>) => Promise<{
      results: T[];
      has_more: boolean;
      next_cursor: string | null;
    }>,
    firstPageArgs: Record<string, unknown>,
  ) {
    let nextCursor = firstPageArgs?.start_cursor;
    do {
      const response = await listFn({
        ...firstPageArgs,
        start_cursor: nextCursor,
      });
      yield* response.results;
      nextCursor = response.has_more ? response.next_cursor : undefined;
    } while (nextCursor);
  },
  isFullPage: (page: unknown) => page && typeof page === "object" && "properties" in page,
  isFullBlock: (block: unknown) => block && typeof block === "object" && "type" in block,
  Client: mock(() => mockClient),
}));
