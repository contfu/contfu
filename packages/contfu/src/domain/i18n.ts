import type { EffectiveCollectionI18nConfig } from "@contfu/core";
import type { FilterAST } from "../infra/filter/types";

export type ClientI18nConfig<Locale extends string = string> = {
  defaultLocale?: Locale;
  fallback?: Locale | true | false;
};

export type LocaleScope<Locale extends string = string> = {
  locale?: Locale | false;
  fallback?: Locale | true | false;
};

export type I18nQueryPlan = {
  collection: string;
  key?: string;
  wantedLocale?: string;
  fallbackLocale?: string;
};

export function filterReferencesLocale(ast: FilterAST): boolean {
  switch (ast.kind) {
    case "comparison":
      return ast.field === "$locale";
    case "function":
      return false;
    case "and":
    case "or":
      return filterReferencesLocale(ast.left) || filterReferencesLocale(ast.right);
    case "group":
      return filterReferencesLocale(ast.expr);
  }
}

export function buildI18nQueryPlan(opts: {
  collection: string;
  collectionI18n: EffectiveCollectionI18nConfig | null | undefined;
  appI18n?: ClientI18nConfig | undefined;
  scope?: LocaleScope | undefined;
  locale?: string | false | undefined;
  fallback?: string | true | false | undefined;
  suppressImplicit?: boolean;
}): I18nQueryPlan | undefined {
  const { collection, collectionI18n, appI18n, scope, locale, fallback, suppressImplicit } = opts;
  if (!collectionI18n?.localized || collectionI18n.locales.length === 0) return undefined;

  if (suppressImplicit) {
    return { collection, key: collectionI18n.key };
  }

  const requestedLocale = locale ?? scope?.locale;
  const explicitAllLocales = requestedLocale === false;
  const wantedLocale = explicitAllLocales ? undefined : (requestedLocale ?? appI18n?.defaultLocale);
  const configuredFallback = explicitAllLocales
    ? false
    : (fallback ?? scope?.fallback ?? appI18n?.fallback);
  const fallbackLocale = resolveFallbackLocale(configuredFallback, appI18n?.defaultLocale);
  const effectiveFallbackLocale =
    wantedLocale !== undefined && fallbackLocale !== undefined && fallbackLocale !== wantedLocale
      ? fallbackLocale
      : undefined;

  return {
    collection,
    key: collectionI18n.key,
    wantedLocale,
    fallbackLocale: effectiveFallbackLocale,
  };
}

function resolveFallbackLocale(
  fallback: string | true | false | undefined,
  defaultLocale: string | undefined,
): string | undefined {
  if (fallback === false || fallback === undefined) return undefined;
  if (fallback === true) {
    if (!defaultLocale) {
      throw new Error("fallback=true requires an i18n defaultLocale to resolve");
    }
    return defaultLocale;
  }
  return fallback;
}
