import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "bun:test";
import { truncateAllTables } from "../test/setup";
import { contfu, type ContfuOptions } from "./contfu";
import { setCollection } from "./features/collections/setCollection";
import { createItem } from "./features/items/createItem";
import { db } from "./infra/db/db";
import { itemsTable } from "./infra/db/schema";

function seed() {
  setCollection(
    "blogPost",
    "Blog Post",
    {},
    { localized: true, locales: ["en", "de"], key: "slug" },
  );
  setCollection(
    "authorProfile",
    "Author Profile",
    {},
    { localized: true, locales: ["en", "de"], key: "name" },
  );
  setCollection("plain", "Plain", {});
  setCollection("noKey", "No Key", {}, { localized: true, locales: ["en", "de"] });

  createItem({
    id: 1,
    ref: "blogPost/alpha-en",
    collection: "blogPost",
    props: { slug: "alpha", $locale: "en", title: "Hello alpha" },
    changedAt: 100,
  });
  createItem({
    id: 2,
    ref: "blogPost/alpha-de",
    collection: "blogPost",
    props: { slug: "alpha", $locale: "de", title: "Hallo alpha" },
    changedAt: 200,
  });
  createItem({
    id: 3,
    ref: "blogPost/beta-de",
    collection: "blogPost",
    props: { slug: "beta", $locale: "de", title: "Hallo beta" },
    changedAt: 300,
  });
  createItem({
    id: 4,
    ref: "blogPost/gamma-en",
    collection: "blogPost",
    props: { slug: "gamma", $locale: "en", title: "Hello gamma" },
    changedAt: 400,
  });

  createItem({
    id: 5,
    ref: "authorProfile/jane-en",
    collection: "authorProfile",
    props: { name: "jane", $locale: "en", bio: "Jane EN" },
    changedAt: 500,
  });
  createItem({
    id: 6,
    ref: "authorProfile/jane-de",
    collection: "authorProfile",
    props: { name: "jane", $locale: "de", bio: "Jane DE" },
    changedAt: 600,
  });

  createItem({
    id: 7,
    ref: "plain/one",
    collection: "plain",
    props: { title: "Plain One" },
    changedAt: 700,
  });
  createItem({
    id: 8,
    ref: "noKey/en",
    collection: "noKey",
    props: { $locale: "en", title: "No Key EN" },
    changedAt: 800,
  });
  createItem({
    id: 9,
    ref: "noKey/de",
    collection: "noKey",
    props: { $locale: "de", title: "No Key DE" },
    changedAt: 900,
  });
}

type Locales = "en" | "de";

type I18nCollections = {
  blogPost: { slug: string; title: string; $locale: Locales };
  authorProfile: { name: string; bio: string; $locale: Locales };
  plain: { title: string };
  noKey: { title: string; $locale: Locales };
};

type I18nClientOverrides = NonNullable<ContfuOptions<I18nCollections>["i18n"]>;

function makeClient(overrides: I18nClientOverrides = {}) {
  return contfu<I18nCollections>({ i18n: overrides }).query;
}

function sortedTitles(items: Array<{ title: string }>) {
  return items.map((p) => p.title).sort((a, b) => a.localeCompare(b));
}

describe("contfu i18n", () => {
  beforeEach(() => {
    truncateAllTables();
    seed();
  });

  test("stores locale in the item column and loads it as $locale", async () => {
    const row = db.select().from(itemsTable).where(eq(itemsTable.id, 1)).get();
    expect(row?.locale).toBe("en");
    expect(row?.props).toEqual({ slug: "alpha", title: "Hello alpha" });

    const posts = await makeClient()("blogPost", { filter: 'slug = "alpha" && $locale = "en"' });
    expect(posts[0].$locale).toBe("en");
  });

  test("localized collections return all locales when the client has no locale preference", async () => {
    const posts = await makeClient()("blogPost");
    expect(sortedTitles(posts)).toEqual([
      "Hallo alpha",
      "Hallo beta",
      "Hello alpha",
      "Hello gamma",
    ]);
  });

  test("app-level defaultLocale filters localized rows", async () => {
    const posts = await makeClient({ defaultLocale: "en" })("blogPost");
    expect(sortedTitles(posts)).toEqual(["Hello alpha", "Hello gamma"]);
  });

  test("locale false explicitly returns all locales and suppresses defaults", async () => {
    const posts = await makeClient({ defaultLocale: "en", fallback: "de" })("blogPost", {
      locale: false,
    });
    expect(sortedTitles(posts)).toEqual([
      "Hallo alpha",
      "Hallo beta",
      "Hello alpha",
      "Hello gamma",
    ]);
  });

  test("fallback groups by key and prefers requested locale", async () => {
    const posts = await makeClient()("blogPost", { locale: "en", fallback: "de" });
    expect(sortedTitles(posts)).toEqual(["Hallo beta", "Hello alpha", "Hello gamma"]);
    expect(posts.total).toBe(3);
  });

  test("client fallback locale is used when the requested locale is missing", async () => {
    // @ts-expect-error defaultLocale must be a valid locale literal from the collection map
    const posts = await makeClient({ defaultLocale: "fr", fallback: "de" })("blogPost");
    expect(sortedTitles(posts)).toEqual(["Hallo alpha", "Hallo beta"]);
    expect(posts.every((p: any) => p.$locale === "de")).toBe(true);
  });

  test("fallback true resolves to the configured default locale", async () => {
    const posts = await makeClient({ defaultLocale: "de" })("blogPost", {
      // @ts-expect-error requested locale must be a valid locale literal from the collection map
      locale: "fr",
      fallback: true,
    });
    expect(sortedTitles(posts)).toEqual(["Hallo alpha", "Hallo beta"]);
  });

  test("fallback true errors when no default locale is configured", async () => {
    // @ts-expect-error requested locale must be a valid locale literal from the collection map
    await makeClient()("blogPost", { locale: "fr", fallback: true }).then(
      () => expect.unreachable("query should reject"),
      (error) =>
        expect(error).toHaveProperty(
          "message",
          "fallback=true requires an i18n defaultLocale to resolve",
        ),
    );
  });

  test("$locale filter suppresses implicit locale selection", async () => {
    const q = makeClient({ defaultLocale: "de" });
    const posts = await q("blogPost", { filter: '$locale = "en"' });
    expect(sortedTitles(posts)).toEqual(["Hello alpha", "Hello gamma"]);
  });

  test("withLocale scopes subsequent queries", async () => {
    const q = makeClient();
    const en = q.withLocale("en", "de");
    const posts = await en("blogPost");
    expect(posts.total).toBe(3);
    expect(posts.find((p: any) => p.slug === "beta")!.$locale).toBe("de");
  });

  test("fallback without grouping key errors only when fallback applies", async () => {
    await makeClient()("noKey", { locale: "en", fallback: "de" }).then(
      () => expect.unreachable("query should reject"),
      (error) => expect(error.message).toContain("missing fallback grouping key"),
    );

    expect(await makeClient()("noKey", { locale: "en", fallback: false })).toHaveLength(1);
    expect(await makeClient()("noKey", { locale: "en", fallback: "en" })).toHaveLength(1);
    expect(await makeClient()("noKey", { locale: false, fallback: "de" })).toHaveLength(2);
    expect(
      await makeClient({ defaultLocale: "en", fallback: "de" })("noKey", {
        filter: '$locale = "de"',
      }),
    ).toHaveLength(1);
  });

  test("non-localized collections ignore locale options", async () => {
    const items = await makeClient()("plain", { locale: "en" });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Plain One");
  });
});
