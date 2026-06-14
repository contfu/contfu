import { describe, expect, it } from "bun:test";
import { resolveAutomaticLocale, resolveSmartLocale } from "./i18n";

describe("resolveSmartLocale", () => {
  it.each(["en-US", "en-us", "en_us", "EN_us", "EN-US", "EN-us"])(
    "canonicalizes BCP47-ish locale %s",
    (raw) => {
      expect(resolveSmartLocale(raw, undefined, ["en-US"])).toBe("en-US");
    },
  );

  it.each(["en", "EN"])("canonicalizes base English locale %s", (raw) => {
    expect(resolveSmartLocale(raw, undefined, ["en"])).toBe("en");
  });

  it.each(["English", "english", "ENGLISH"])("resolves English alias %s", (raw) => {
    expect(resolveSmartLocale(raw, undefined, ["en"])).toBe("en");
  });

  it.each(["de", "DE", "Deutsch", "deutsch", "German", "GERMAN"])(
    "resolves German locale or alias %s",
    (raw) => {
      expect(resolveSmartLocale(raw, undefined, ["de"])).toBe("de");
    },
  );

  it("lets exact locale map entries override detectable values", () => {
    expect(resolveSmartLocale("en-US", { "en-US": "en" }, ["en", "en-US"])).toBe("en");
  });

  it("exposes automatic resolution without locale map overrides for redundant mapping hints", () => {
    expect(resolveAutomaticLocale("English", ["en"])).toBe("en");
    expect(resolveAutomaticLocale("en-US", ["en", "en-US"])).toBe("en-US");
  });

  it("matches locale map keys case-insensitively when unambiguous", () => {
    expect(resolveSmartLocale("english", { English: "en" }, ["en"])).toBe("en");
  });

  it("matches locale map keys with normalized separators when unambiguous", () => {
    expect(resolveSmartLocale("en_us", { "en-US": "en" }, ["en", "en-US"])).toBe("en");
  });

  it("does not pick ambiguous normalized locale map keys", () => {
    expect(resolveSmartLocale("ENGLISH", { English: "en", english: "de" }, ["en", "de"])).toBe(
      null,
    );
  });

  it("still honors exact matches when normalized locale map keys collide", () => {
    expect(resolveSmartLocale("English", { English: "en", english: "de" }, ["en", "de"])).toBe(
      "en",
    );
  });

  it("resolves locale aliases from English and native locale names", () => {
    expect(resolveSmartLocale("French", undefined, ["fr"])).toBe("fr");
    expect(resolveSmartLocale("français", undefined, ["fr"])).toBe("fr");
    expect(resolveSmartLocale("Japanese", undefined, ["ja"])).toBe("ja");
    expect(resolveSmartLocale("日本語", undefined, ["ja"])).toBe("ja");
    expect(resolveSmartLocale("Brazilian Portuguese", undefined, ["pt-BR"])).toBe("pt-BR");
    expect(resolveSmartLocale("Português (Brasil)", undefined, ["pt-BR"])).toBe("pt-BR");
  });

  it("constrains aliases to active locales when active locales are present", () => {
    expect(resolveSmartLocale("English", undefined, ["en-US"])).toBe(null);
    expect(resolveSmartLocale("American English", undefined, ["en-US"])).toBe("en-US");
  });
});
