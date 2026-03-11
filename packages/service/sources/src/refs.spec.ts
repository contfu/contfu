import { describe, expect, test } from "bun:test";
import { ConnectionType } from "@contfu/core";
import {
  contentfulRefUrl,
  getItemRefForSource,
  notionRefUrlFromRawUuid,
  strapiRefUrl,
  webRefUrl,
} from "./refs";

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

  test("builds contentful ref URL", () => {
    const url = contentfulRefUrl(
      Buffer.from("abc123def456", "utf8"),
      "https://cms.contentful.com/",
      Buffer.from("blogPost", "utf8"),
    );
    expect(url).toBe("https://cms.contentful.com/entries/abc123def456");
  });

  test("builds contentful ref URL without trailing slash", () => {
    const url = contentfulRefUrl(
      Buffer.from("abc123def456", "utf8"),
      "https://cms.contentful.com",
      Buffer.from("blogPost", "utf8"),
    );
    expect(url).toBe("https://cms.contentful.com/entries/abc123def456");
  });

  test("builds web ref URL", () => {
    expect(webRefUrl(Buffer.from("https://example.com/page", "utf8"))).toBe(
      "https://example.com/page",
    );
  });

  test("builds sourceType + ref for source selector", () => {
    const encoded = getItemRefForSource({
      sourceType: ConnectionType.WEB,
      rawRef: Buffer.from("https://example.com/a", "utf8"),
    });
    expect(encoded).toEqual({ sourceType: ConnectionType.WEB, ref: "https://example.com/a" });
  });

  test("getItemRefForSource with Contentful", () => {
    const encoded = getItemRefForSource({
      sourceType: ConnectionType.CONTENTFUL,
      rawRef: Buffer.from("abc123def456", "utf8"),
      sourceUrl: "https://cms.contentful.com",
      collectionRef: Buffer.from("blogPost", "utf8"),
    });
    expect(encoded).toEqual({
      sourceType: ConnectionType.CONTENTFUL,
      ref: "https://cms.contentful.com/entries/abc123def456",
    });
  });

  test("getItemRefForSource throws for Contentful without sourceUrl", () => {
    expect(() =>
      getItemRefForSource({
        sourceType: ConnectionType.CONTENTFUL,
        rawRef: Buffer.from("abc123def456", "utf8"),
        collectionRef: Buffer.from("blogPost", "utf8"),
      }),
    ).toThrow("Missing sourceUrl for Contentful ref encoding");
  });

  test("getItemRefForSource throws for Contentful without collectionRef", () => {
    expect(() =>
      getItemRefForSource({
        sourceType: ConnectionType.CONTENTFUL,
        rawRef: Buffer.from("abc123def456", "utf8"),
        sourceUrl: "https://cms.contentful.com",
      }),
    ).toThrow("Missing collectionRef for Contentful ref encoding");
  });
});
