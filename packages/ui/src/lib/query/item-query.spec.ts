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

  test.each([["page"], ["pageSize"], ["changedAtFrom"], ["changedAtTo"]])(
    "ignores invalid numeric query params for %s",
    (key) => {
      const url = new URL(`http://localhost/items?${key}=not-a-number`);
      const parsed = parseItemQueryFromUrl(url);

      expect(parsed[key]).toBeUndefined();
    },
  );

  test("parses valid numeric query params", () => {
    const parsed = parseItemQueryFromUrl(
      new URL("http://localhost/items?page=2&pageSize=25&changedAtFrom=10&changedAtTo=20"),
    );

    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(25);
    expect(parsed.changedAtFrom).toBe(10);
    expect(parsed.changedAtTo).toBe(20);
  });

  test("ignores mismatched and unsupported property filter params", () => {
    const parsed = parseItemQueryFromUrl(
      new URL(
        "http://localhost/items?propKey=title&propKey=featured&propKey=views&propOp=eq&propOp=lt&propValue=hello&propValue=true",
      ),
    );

    expect(parsed.propFilters).toEqual([{ key: "title", op: "eq", value: "hello" }]);
  });

  test("ignores empty property filter values", () => {
    const parsed = parseItemQueryFromUrl(
      new URL("http://localhost/items?propKey=title&propOp=contains&propValue="),
    );

    expect(parsed.propFilters).toBeUndefined();
  });

  test.each([
    ["true", true],
    ["false", false],
    ["42", 42],
    ["3.14", 3.14],
    ["hello", "hello"],
    ["  ", "  "],
  ])("coerces property filter values from %p to %p", (rawValue, expected) => {
    const parsed = parseItemQueryFromUrl(
      new URL(
        `http://localhost/items?propKey=value&propOp=eq&propValue=${encodeURIComponent(rawValue)}`,
      ),
    );

    expect(parsed.propFilters).toEqual([{ key: "value", op: "eq", value: expected }]);
  });

  test("parses multiple property filters in order", () => {
    const parsed = parseItemQueryFromUrl(
      new URL(
        "http://localhost/items?propKey=featured&propOp=eq&propValue=true&propKey=views&propOp=eq&propValue=42&propKey=title&propOp=contains&propValue=guide",
      ),
    );

    expect(parsed.propFilters).toEqual([
      { key: "featured", op: "eq", value: true },
      { key: "views", op: "eq", value: 42 },
      { key: "title", op: "contains", value: "guide" },
    ]);
  });

  test("locked collection takes precedence when parsing", () => {
    const parsed = parseItemQueryFromUrl(new URL("http://localhost/items?collection=articles"), {
      lockedCollection: "pages",
    });

    expect(parsed.collection).toBe("pages");
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

  test("round-trips representative query state", () => {
    const input = {
      collection: "articles",
      changedAtFrom: 100,
      changedAtTo: 200,
      sortField: "changedAt" as const,
      sortDirection: "desc" as const,
      page: 4,
      pageSize: 25,
      propFilters: [
        { key: "featured", op: "eq" as const, value: true },
        { key: "views", op: "eq" as const, value: 42 },
      ],
    };

    const params = buildItemQuerySearchParams(input);
    const parsed = parseItemQueryFromUrl(new URL(`http://localhost/items?${params.toString()}`));

    expect(parsed).toEqual(input);
  });
});
