import { ConnectionType } from "@contfu/core";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { SyncConfig } from "./getSyncConfig";

// ---------------------------------------------------------------------------
// Module mocks — must be set up before the module under test is imported
// ---------------------------------------------------------------------------

const mockCheckQuota =
  mock<
    (userId: number, field: string) => Promise<{ allowed: boolean; current: number; max: number }>
  >();
const mockAddItems = mock<(userId: number, count: number) => Promise<void>>();

await mock.module("../../infra/nats/quota-kv", () => ({
  checkQuota: mockCheckQuota,
  addItems: mockAddItems,
}));

// Mutable state shared with the mock fetch implementation
let mockSourceItems: Array<{
  ref: Buffer;
  id: Buffer;
  collection: number;
  changedAt: number;
  props: Record<string, unknown>;
}> = [];

const mockWebFetch = mock(() => {
  const items = mockSourceItems;
  return (function* () {
    for (const item of items) yield item;
  })();
});

await mock.module("@contfu/svc-sources", () => ({
  getItemRefForSource: ({
    rawRef,
  }: {
    rawRef: Buffer;
    sourceType: number;
    sourceUrl?: string | null;
    collectionRef?: Buffer | null;
  }) => ({
    sourceType: ConnectionType.WEB,
    ref: rawRef.toString("utf8"),
  }),
  webSource: { fetch: mockWebFetch },
  notionSource: { fetch: mock() },
  strapiSource: { fetch: mock() },
}));

const { fetchAndStreamItems, ValidationErrorCollector } = await import("./fetchAndStreamItems");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(url = "http://example.com/page") {
  return {
    ref: Buffer.from(url),
    id: Buffer.from("id"),
    collection: 0,
    changedAt: 1000,
    props: {} as Record<string, unknown>,
  };
}

function makeItems(count: number): typeof mockSourceItems {
  return Array.from({ length: count }, (_, i) => makeItem(`http://example.com/${i}`));
}

function makeConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
  return {
    userId: 1,
    targetCollectionIds: [100],
    connectionGroups: [
      {
        connectionType: ConnectionType.WEB,
        connectionUrl: "http://example.com",
        credentials: null,
        sourceCollections: [
          {
            collectionId: 1,
            collectionRef: Buffer.from("http://example.com/sitemap.xml"),
            targets: [
              {
                flowId: 1,
                targetCollectionId: 100,
                filters: null,
                includeRef: false,
                mappings: null,
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function drain(gen: AsyncGenerator<unknown>): Promise<number> {
  let count = 0;
  for await (const _ of gen) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchAndStreamItems quota pre-deduction", () => {
  beforeEach(() => {
    mockSourceItems = [];
    mockCheckQuota.mockReset();
    mockAddItems.mockReset();
    mockAddItems.mockResolvedValue(undefined);
    // Default: unlimited quota (max = -1)
    mockCheckQuota.mockResolvedValue({ allowed: true, current: 0, max: -1 });
    // Restore default web fetch implementation
    mockWebFetch.mockImplementation(() => {
      const items = mockSourceItems;
      return (function* () {
        for (const item of items) yield item;
      })();
    });
  });

  it("reserves PAGE_SIZE slots upfront; no refund when exactly PAGE_SIZE items consumed", async () => {
    mockSourceItems = makeItems(100); // exactly PAGE_SIZE

    const yielded = await drain(fetchAndStreamItems(makeConfig()));

    expect(yielded).toBe(100);
    // checkQuota called once (first batch only — no re-check within a page)
    expect(mockCheckQuota.mock.calls).toHaveLength(1);
    // addItems called once with +100 only — consumed === reserved, no refund
    expect(mockAddItems.mock.calls).toHaveLength(1);
    expect((mockAddItems.mock.calls[0] as unknown[])[1]).toBe(100);
  });

  it("refunds unused slots when fewer items than PAGE_SIZE are returned", async () => {
    mockSourceItems = makeItems(3);

    await drain(fetchAndStreamItems(makeConfig()));

    // addItems(+100) then addItems(-97)
    expect(mockAddItems.mock.calls).toHaveLength(2);
    expect((mockAddItems.mock.calls[0] as unknown[])[1]).toBe(100);
    expect((mockAddItems.mock.calls[1] as unknown[])[1]).toBe(-97);
  });

  it("refunds unused slots on source fetch error; does not re-throw", async () => {
    // Source yields 3 items then throws
    const items = makeItems(3);
    let count = 0;
    mockWebFetch.mockImplementation(() => {
      return (function* () {
        for (const item of items) {
          yield item;
          count++;
          if (count >= 3) throw new Error("Network error");
        }
      })();
    });

    // Should not throw — error is caught and swallowed internally
    const yielded = await drain(fetchAndStreamItems(makeConfig()));
    expect(yielded).toBeGreaterThanOrEqual(0);

    // Reserved 100 slots, consumed some items before the error — refund is issued
    const addCalls = mockAddItems.mock.calls as unknown[][];
    expect(addCalls[0][1]).toBe(100); // initial reserve
    const refund = addCalls[addCalls.length - 1][1] as number;
    expect(refund).toBeLessThan(0); // a refund was issued
    expect(refund).toBeGreaterThanOrEqual(-100); // can't refund more than reserved
  });

  it("counts validation failures against quota (consumed++, no extra refund)", async () => {
    // 3 items: first fails validation (string where number expected), rest pass
    mockSourceItems = [
      { ...makeItem("http://example.com/bad"), props: { score: "not-a-number" } },
      { ...makeItem("http://example.com/ok1"), props: { score: 42 } },
      { ...makeItem("http://example.com/ok2"), props: { score: 7 } },
    ];

    const config = makeConfig();
    // Add a cast mapping that will fail for the first item
    config.connectionGroups[0].sourceCollections[0].targets[0].mappings = [
      { source: "score", target: "score", cast: "number" },
    ];

    const collector = new ValidationErrorCollector();
    const yielded = await drain(fetchAndStreamItems(config, collector));

    // Only 2 items pass validation and are yielded
    expect(yielded).toBe(2);
    // But consumed = 3 (all 3 items from source counted)
    // So refund = 100 - 3 = 97
    expect(mockAddItems.mock.calls).toHaveLength(2);
    expect((mockAddItems.mock.calls[0] as unknown[])[1]).toBe(100);
    expect((mockAddItems.mock.calls[1] as unknown[])[1]).toBe(-97);
    // Validation error was collected
    expect(collector.size).toBe(1);
  });

  it("stops syncing when quota is exhausted; no further collections are fetched", async () => {
    mockSourceItems = makeItems(5);

    // Two source collections
    const config = makeConfig();
    const sourceCollection = config.connectionGroups[0].sourceCollections[0];
    config.connectionGroups[0].sourceCollections = [sourceCollection, { ...sourceCollection }];

    // First check reserves 2 slots (max=2), second check sees quota exhausted
    mockCheckQuota
      .mockResolvedValueOnce({ allowed: true, current: 0, max: 2 }) // first reservation
      .mockResolvedValueOnce({ allowed: false, current: 2, max: 2 }); // exhausted

    const yielded = await drain(fetchAndStreamItems(config));

    // Only 2 items yielded (from first reservation), sync stopped before second collection
    expect(yielded).toBe(2);
    // addItems called once with +2 (toReserve = min(100, 2-0) = 2)
    // reserved(2) === consumed(2) so no refund
    expect(mockAddItems.mock.calls).toHaveLength(1);
    expect((mockAddItems.mock.calls[0] as unknown[])[1]).toBe(2);
  });
});
