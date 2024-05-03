import type { Client } from "@notionhq/client";
import { mock } from "bun:test";
import { DeepPartial } from "ts-essentials";

export const mockClient = {
  databases: {
    query: mock(),
  },
} satisfies DeepPartial<Client>;
