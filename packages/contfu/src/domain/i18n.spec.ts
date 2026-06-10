import { describe, expect, test } from "bun:test";
import { buildI18nQueryPlan, filterReferencesLocale } from "./i18n";
import { parse } from "../infra/filter/parser";
import { tokenize } from "../infra/filter/lexer";

describe("buildI18nQueryPlan", () => {
  const collectionI18n = {
    localized: true,
    locales: ["de", "en"],
    key: "slug",
  };

  test("returns undefined for non-localized collections", () => {
    expect(
      buildI18nQueryPlan({
        collection: "plain",
        collectionI18n: undefined,
      }),
    ).toBeUndefined();
  });

  test("does not choose a locale when the client has no defaults", () => {
    expect(
      buildI18nQueryPlan({
        collection: "blogPost",
        collectionI18n,
      }),
    ).toEqual({
      collection: "blogPost",
      key: "slug",
      wantedLocale: undefined,
      fallbackLocale: undefined,
    });
  });

  test("resolves app and scope overrides in order", () => {
    expect(
      buildI18nQueryPlan({
        collection: "blogPost",
        collectionI18n,
        appI18n: { defaultLocale: "en", fallback: "de" },
        scope: { locale: "de", fallback: "en" },
        locale: "fr",
      }),
    ).toEqual({
      collection: "blogPost",
      key: "slug",
      wantedLocale: "fr",
      fallbackLocale: "en",
    });
  });

  test("fallback false disables fallback", () => {
    expect(
      buildI18nQueryPlan({
        collection: "blogPost",
        collectionI18n,
        locale: "en",
        fallback: false,
      }),
    ).toEqual({
      collection: "blogPost",
      key: "slug",
      wantedLocale: "en",
      fallbackLocale: undefined,
    });
  });

  test("suppresses implicit locale selection when filter already references $locale", () => {
    expect(
      buildI18nQueryPlan({
        collection: "blogPost",
        collectionI18n,
        suppressImplicit: true,
      }),
    ).toEqual({
      collection: "blogPost",
      key: "slug",
    });
  });
});

describe("filterReferencesLocale", () => {
  function ast(filter: string) {
    return parse(tokenize(filter));
  }

  test("detects $locale reference", () => {
    expect(filterReferencesLocale(ast('$locale = "en"'))).toBe(true);
  });

  test("returns false for unrelated fields", () => {
    expect(filterReferencesLocale(ast('title = "Hello"'))).toBe(false);
  });

  test("descends into boolean groups", () => {
    expect(filterReferencesLocale(ast('(title = "x" && $locale = "en")'))).toBe(true);
  });
});
