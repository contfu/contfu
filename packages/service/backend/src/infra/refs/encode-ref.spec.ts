import { describe, expect, test } from "bun:test";
import { SourceType } from "@contfu/core";
import {
  getItemRefForSource,
  notionRefUrlFromRawUuid,
  strapiRefUrl,
  webRefUrl,
} from "./encode-ref";

describe("encode-ref", () => {
  test("builds notion ref URL", () => {
    const raw = Buffer.from("2e5459d4e3a980ee8dc6fa918c5f7f17", "hex");
    expect(notionRefUrlFromRawUuid(raw)).toBe("https://notion.so/2e5459d4e3a980ee8dc6fa918c5f7f17");
  });

  test("builds strapi ref URL", () => {
    const url = strapiRefUrl(
      Buffer.from("abc123def456", "utf8"),
      "https://cms.example.com/",
      Buffer.from("api::article.article", "utf8"),
    );
    expect(url).toBe("https://cms.example.com/api/articles/abc123def456");
  });

  test("builds web ref URL", () => {
    expect(webRefUrl(Buffer.from("https://example.com/page", "utf8"))).toBe(
      "https://example.com/page",
    );
  });

  test("builds sourceType + ref for source selector", () => {
    const encoded = getItemRefForSource({
      sourceType: SourceType.WEB,
      rawRef: Buffer.from("https://example.com/a", "utf8"),
    });
    expect(encoded).toEqual({ sourceType: SourceType.WEB, ref: "https://example.com/a" });
  });
});
