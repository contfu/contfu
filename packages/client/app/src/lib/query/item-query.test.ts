import { describe, expect, test } from "bun:test";
import { buildItemQuerySearchParams, parseItemQueryFromUrl } from "./item-query";

describe("item-query helper", () => {
  test("parses query params including prop filters", () => {
    const url = new URL(
      "http://localhost/items?collection=articles&sortField=collection&sortDirection=asc&page=2&pageSize=50&propKey=featured&propOp=eq&propValue=true",
    );
    const parsed = parseItemQueryFromUrl(url);

    expect(parsed.collection).toBe("articles");
    expect(parsed.sortField).toBe("collection");
    expect(parsed.sortDirection).toBe("asc");
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.propFilters).toEqual([{ key: "featured", op: "eq", value: true }]);
  });

  test("builds query params and omits locked collection", () => {
    const params = buildItemQuerySearchParams(
      {
        collection: "articles",
        sortField: "changedAt",
        sortDirection: "desc",
        page: 3,
      },
      { lockedCollection: "articles" },
    );

    expect(params.get("collection")).toBeNull();
    expect(params.get("sortField")).toBe("changedAt");
    expect(params.get("sortDirection")).toBe("desc");
    expect(params.get("page")).toBe("3");
  });
});
