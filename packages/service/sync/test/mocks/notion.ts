import { mock } from "bun:test";
import type { Client } from "notion-client-web-fetch";
import { DeepPartial } from "ts-essentials";

export const mockClient = {
  databases: {
    query: mock(),
  },
  blocks: {
    children: { list: mock() },
  },
} satisfies DeepPartial<Client>;
