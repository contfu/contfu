export const BCP47_LOCALES = [
  "af",
  "ar",
  "ar-AE",
  "ar-EG",
  "ar-SA",
  "bg",
  "bn",
  "ca",
  "cs",
  "da",
  "de",
  "de-AT",
  "de-CH",
  "de-DE",
  "el",
  "en",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-IE",
  "en-IN",
  "en-NZ",
  "en-SG",
  "en-US",
  "en-ZA",
  "es",
  "es-AR",
  "es-CL",
  "es-CO",
  "es-ES",
  "es-MX",
  "es-PE",
  "es-US",
  "et",
  "fa",
  "fi",
  "fil",
  "fr",
  "fr-BE",
  "fr-CA",
  "fr-CH",
  "fr-FR",
  "gu",
  "he",
  "hi",
  "hr",
  "hu",
  "hy",
  "id",
  "is",
  "it",
  "it-CH",
  "it-IT",
  "ja",
  "ka",
  "kk",
  "km",
  "kn",
  "ko",
  "lt",
  "lv",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms",
  "mt",
  "nb",
  "nl",
  "nl-BE",
  "nl-NL",
  "pl",
  "pt",
  "pt-BR",
  "pt-PT",
  "ro",
  "ru",
  "sk",
  "sl",
  "sq",
  "sr",
  "sr-Latn",
  "sv",
  "sw",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "ur",
  "uz",
  "vi",
  "zh",
  "zh-CN",
  "zh-HK",
  "zh-Hans",
  "zh-Hant",
  "zh-MO",
  "zh-SG",
  "zh-TW",
] as const;

export type Bcp47Locale = (typeof BCP47_LOCALES)[number];

export type ActiveLocalesConfig = { mode: "inherit" } | { mode: "custom"; locales: string[] };

export type DetectedIntegrationI18nConfig = {
  locales: string[];
};

export type DetectedCollectionI18nConfig = {
  localized: boolean;
  localeField?: string;
};

export type IntegrationI18nConfig = {
  /** User localization layer locales. */
  locales?: string[];
  localeMap?: Record<string, string>;
  /** Service-detected locales, kept separate from user layer config. */
  detected?: DetectedIntegrationI18nConfig;
  activeLocales?: ActiveLocalesConfig;
};

export type CollectionI18nConfig = {
  /** User localization layer locale field. */
  localeField?: string;
  localeMap?: Record<string, string>;
  keepLocaleField?: boolean;
  key?: string;
  /** Service-detected localization, kept separate from user layer config. */
  detected?: DetectedCollectionI18nConfig;
};

export type AppIntegrationI18nConfig = {
  locales: string[];
};

export type AppCollectionI18nConfig = {
  key?: string;
};

export type EffectiveCollectionI18nConfig = AppIntegrationI18nConfig &
  AppCollectionI18nConfig & {
    localized: boolean;
  };

export function canonicalizeBcp47(code: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(code);
    return canonical ?? null;
  } catch {
    return null;
  }
}

export function isBcp47(code: string): boolean {
  return canonicalizeBcp47(code) !== null;
}

function normalizeLocaleLookupKey(value: string): string {
  return value.trim().replaceAll("_", "-").toLocaleLowerCase();
}

const BCP47_LOCALE_SET = new Set<string>(BCP47_LOCALES);

function addLocaleAlias(
  aliases: Map<string, string | null>,
  rawAlias: string,
  locale: string,
): void {
  const alias = rawAlias.trim().toLocaleLowerCase();
  if (!alias) return;
  const existing = aliases.get(alias);
  if (existing === undefined) aliases.set(alias, locale);
  else if (existing !== locale) aliases.set(alias, null);
}

function buildLocaleAliases(): Map<string, string | null> {
  const aliases = new Map<string, string | null>();
  const englishNames = new Intl.DisplayNames(["en"], { type: "language" });

  for (const locale of BCP47_LOCALES) {
    const englishName = englishNames.of(locale);
    if (englishName) addLocaleAlias(aliases, englishName, locale);

    const nativeName = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
    if (nativeName) addLocaleAlias(aliases, nativeName, locale);
  }

  return aliases;
}

const LOCALE_ALIASES = buildLocaleAliases();
const AMBIGUOUS_LOCALE_MAP_MATCH = Symbol("ambiguous locale map match");

function resolveLocaleMapValue(value: string): string | null {
  return canonicalizeBcp47(value.replaceAll("_", "-"));
}

function resolveLocaleMapMatch(
  rawLocale: string,
  localeMap: Record<string, string> | undefined,
): string | null | undefined | typeof AMBIGUOUS_LOCALE_MAP_MATCH {
  if (!localeMap) return undefined;

  const exact = localeMap[rawLocale];
  if (exact !== undefined) return resolveLocaleMapValue(exact);

  const lookupKey = normalizeLocaleLookupKey(rawLocale);
  let match: string | null = null;
  let matched = false;

  for (const [raw, locale] of Object.entries(localeMap)) {
    if (normalizeLocaleLookupKey(raw) !== lookupKey) continue;
    if (matched) return AMBIGUOUS_LOCALE_MAP_MATCH;
    matched = true;
    match = resolveLocaleMapValue(locale);
  }

  return match ?? undefined;
}

export function resolveAutomaticLocale(
  rawValue: string,
  activeLocales: readonly string[] = [],
): string | null {
  const rawLocale = rawValue.trim();
  if (!rawLocale) return null;

  const canonical = canonicalizeBcp47(rawLocale.replaceAll("_", "-"));
  if (canonical && BCP47_LOCALE_SET.has(canonical)) return canonical;

  const alias = LOCALE_ALIASES.get(rawLocale.toLocaleLowerCase());
  if (!alias) return null;
  if (activeLocales.length > 0 && !activeLocales.includes(alias)) return null;
  return alias;
}

export function resolveSmartLocale(
  rawValue: string,
  localeMap?: Record<string, string>,
  activeLocales: readonly string[] = [],
): string | null {
  const rawLocale = rawValue.trim();
  if (!rawLocale) return null;

  const mapped = resolveLocaleMapMatch(rawLocale, localeMap);
  if (mapped === AMBIGUOUS_LOCALE_MAP_MATCH) return null;
  if (mapped) return mapped;

  return resolveAutomaticLocale(rawLocale, activeLocales);
}

export function normalizeLocaleList(locales: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const locale of locales) {
    const canonical = canonicalizeBcp47(locale);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    normalized.push(canonical);
  }

  return normalized;
}

export function normalizeLocaleMap(
  localeMap: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!localeMap) return undefined;

  const normalized: Record<string, string> = {};
  const seen = new Map<string, string>();

  for (const [raw, locale] of Object.entries(localeMap)) {
    const source = raw.trim();
    if (!source) throw new Error("localeMap source keys must not be empty");

    const canonical = canonicalizeBcp47(locale.trim());
    if (!canonical) throw new Error(`localeMap target for "${source}" must be a valid locale`);

    const lookup = normalizeLocaleLookupKey(source);
    const existing = seen.get(lookup);
    if (existing !== undefined && existing !== source) {
      throw new Error(`localeMap source "${source}" conflicts with "${existing}"`);
    }
    seen.set(lookup, source);
    normalized[source] = canonical;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function mergeAppI18n(
  integration: AppIntegrationI18nConfig | undefined,
  collection: AppCollectionI18nConfig | undefined,
): EffectiveCollectionI18nConfig | undefined {
  const locales = normalizeLocaleList(integration?.locales ?? []);
  const hasCollectionConfig = collection?.key !== undefined;

  if (locales.length === 0 && !hasCollectionConfig) {
    return undefined;
  }

  return {
    localized: locales.length > 0,
    locales,
    key: collection?.key,
  };
}
