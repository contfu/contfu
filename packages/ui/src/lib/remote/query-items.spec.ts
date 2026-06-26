import { describe, expect, it } from "bun:test";
import { queryItemsSearchParams } from "./query-items";

describe("queryItemsSearchParams", () => {
  it("serializes shared item query filters", () => {
    const params = queryItemsSearchParams({
      changedAtFrom: 10,
      changedAtTo: 20,
      sortField: "changedAt",
      sortDirection: "desc",
      page: 2,
      pageSize: 50,
      propFilters: [{ key: "title", op: "contains", value: "launch" }],
    });

    expect(params.toString()).toBe(
      "changedAtFrom=10&changedAtTo=20&sortField=changedAt&sortDirection=desc&page=2&pageSize=50&propFilters=%5B%7B%22key%22%3A%22title%22%2C%22op%22%3A%22contains%22%2C%22value%22%3A%22launch%22%7D%5D",
    );
  });

  it("serializes collection only when requested", () => {
    const params = queryItemsSearchParams({ collection: "posts" }, { includeCollection: true });

    expect(params.toString()).toBe("collection=posts");
  });

  it("omits empty optional values", () => {
    const params = queryItemsSearchParams({ collection: "posts", propFilters: [] });

    expect(params.toString()).toBe("");
  });
});
