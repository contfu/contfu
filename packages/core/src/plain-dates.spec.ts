import { describe, expect, it } from "bun:test";
import { formatPlainDateResults } from "./plain-dates";
import { PropertyType } from "./schemas";

describe("formatPlainDateResults", () => {
  it("keeps the calendar day in a negative-offset timezone", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const result = formatPlainDateResults([{ $collection: "posts", publishDate: 20_635 }], {
        posts: { publishDate: PropertyType.PLAINDATE },
      });
      expect(result[0].publishDate as unknown).toBe("2026-07-01");
    } finally {
      process.env.TZ = previous;
    }
  });

  it("supports explicit milliseconds output and nested relation results", () => {
    const result = formatPlainDateResults(
      {
        $collection: "posts",
        publishDate: 20_635,
        author: { $collection: "authors", birthday: -1 },
      },
      {
        posts: { publishDate: PropertyType.PLAINDATE },
        authors: { birthday: PropertyType.PLAINDATE },
      },
      "milliseconds",
    );
    expect(result.publishDate).toBe(Date.UTC(2026, 6, 1));
    expect(result.author.birthday).toBe(-86_400_000);
  });
});
