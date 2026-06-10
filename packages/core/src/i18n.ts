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

export type ConnectionI18nConfig = {
  locales: string[];
  localeMap?: Record<string, string>;
};

export type CollectionI18nConfig = {
  localeField?: string;
  localeMap?: Record<string, string>;
  keepLocaleField?: boolean;
  key?: string;
};

export type AppConnectionI18nConfig = {
  locales: string[];
};

export type AppCollectionI18nConfig = {
  key?: string;
};

export type EffectiveCollectionI18nConfig = AppConnectionI18nConfig &
  AppCollectionI18nConfig & {
    localized: boolean;
  };

export type ConnectionI18nTuple = [
  version: 1,
  locales: string[],
  localeMap: Record<string, string> | null,
  legacyDefaultLocale?: string | null,
  legacyFallback?: boolean | null,
];

export type CollectionI18nTuple = [
  version: 1,
  localeField: string | null,
  localeMap: Record<string, string> | null,
  keepLocaleField: boolean,
  key: string | null,
  legacyDefaultLocale?: string | null,
  legacyFallback?: boolean | null,
];

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

  const normalized = Object.fromEntries(
    Object.entries(localeMap)
      .map(([raw, locale]) => {
        const canonical = canonicalizeBcp47(locale);
        return canonical ? ([raw, canonical] as const) : null;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null),
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function mergeAppI18n(
  connection: AppConnectionI18nConfig | undefined,
  collection: AppCollectionI18nConfig | undefined,
): EffectiveCollectionI18nConfig | undefined {
  const locales = normalizeLocaleList(connection?.locales ?? []);
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
