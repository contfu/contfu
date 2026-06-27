import {
  QueryResultArray,
  normalizeQueryArgs,
  renderBlocks,
  renderBlocksMarkdown,
  resolveQueryFilter,
  resolveQueryWithFunctions,
} from "@contfu/core";
import type {
  Block,
  ContentFormat,
  MarkdownOptions,
  QueryMeta,
  QueryOptions,
  RenderOptions,
} from "@contfu/core";
import {
  all,
  and,
  contains,
  eq,
  gt,
  gte,
  like,
  linkedFrom,
  linksTo,
  lt,
  lte,
  ne,
  notLike,
  oneOf,
  or,
} from "@contfu/core";

export type HttpClientOptions = {
  i18n?: {
    defaultLocale?: string;
    fallback?: string | true | false;
  };
  /** HTTP Basic auth for a Server protected with CONTFU_BASIC_AUTH. */
  basicAuth?: string | { username: string; password: string };
};

function normalizeBasicAuth(basicAuth: NonNullable<HttpClientOptions["basicAuth"]>): string {
  return typeof basicAuth === "string" ? basicAuth : `${basicAuth.username}:${basicAuth.password}`;
}

function buildBasicAuthHeader(config: string): string {
  if (typeof globalThis.btoa === "function") {
    const bytes = new TextEncoder().encode(config);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `Basic ${globalThis.btoa(binary)}`;
  }
  return `Basic ${Buffer.from(config, "utf8").toString("base64")}`;
}

export function contfuClient<_CMap>(
  baseUrl: string,
  apiKey?: string,
  options: HttpClientOptions = {},
): any {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  if (options.basicAuth) {
    headers["Authorization"] = buildBasicAuthHeader(normalizeBasicAuth(options.basicAuth));
  }

  return buildClient(baseUrl, headers, {
    defaultLocale: options.i18n?.defaultLocale,
    locale: options.i18n?.defaultLocale,
    fallback: options.i18n?.fallback,
  });
}

/**
 * @deprecated Use `contfuClient` instead.
 */
export const createHttpClient = contfuClient;

/**
 * @deprecated Use `contfuClient` instead.
 */
export const createHttpTypedClient = contfuClient;

type LocaleScope = {
  defaultLocale?: string;
  locale?: string | false;
  fallback?: string | true | false;
  fallbackExplicit?: boolean;
};

function buildClient(
  baseUrl: string,
  headers: Record<string, string>,
  scope: LocaleScope = {},
): any {
  async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  const callable = async (first?: any, second?: any) => {
    const { options } = normalizeQueryArgs(first, second);
    const { collection, contentAs, htmlOptions, markdownOptions, locale, fallback, ...rest } =
      options as QueryOptions & {
        collection?: string;
      };
    const filter = resolveQueryFilter(rest.filter);
    const resolvedWith = resolveQueryWithFunctions(rest.with as any);
    const include = resolveInclude(rest.include, contentAs);
    const effectiveLocale = locale ?? scope.locale;
    const fallbackExplicit = fallback !== undefined || scope.fallbackExplicit === true;
    const effectiveFallback = resolveFallbackParam(
      fallback !== undefined ? fallback : scope.fallback,
      scope.defaultLocale,
      fallbackExplicit,
    );
    const params = serializeQueryParams({
      ...rest,
      locale: effectiveLocale,
      fallback:
        effectiveLocale === false && fallback === undefined && scope.fallback !== false
          ? undefined
          : effectiveFallback,
      filter,
      with: resolvedWith,
      include,
    });

    const url = collection
      ? `${baseUrl}/api/collections/${encodeURIComponent(collection)}/items?${params.toString()}`
      : `${baseUrl}/api/items?${params.toString()}`;
    const json = await fetchJson<{ data: any[]; meta: QueryMeta }>(url);
    const data = transformContent(json.data, contentAs, htmlOptions, markdownOptions);
    return new QueryResultArray(data, json.meta);
  };

  const withLocale = (locale: string | false, fallback?: string | true | false) =>
    buildClient(baseUrl, headers, {
      defaultLocale: scope.defaultLocale,
      locale,
      fallback: fallback !== undefined ? fallback : scope.fallback,
      fallbackExplicit: fallback !== undefined ? true : scope.fallbackExplicit,
    });

  return Object.assign(callable, {
    all,
    oneOf,
    eq,
    ne,
    gt,
    gte,
    lt,
    lte,
    like,
    notLike,
    contains,
    and,
    or,
    linksTo,
    linkedFrom,
    withLocale,
  });
}

function resolveFallbackParam(
  fallback: string | true | false | undefined,
  defaultLocale: string | undefined,
  fallbackExplicit: boolean,
): string | true | false | undefined {
  if (fallback === true) return defaultLocale ?? (fallbackExplicit ? true : undefined);
  return fallback;
}

function resolveInclude(
  include: QueryOptions["include"],
  contentAs: ContentFormat | undefined,
): QueryOptions["include"] {
  if (!contentAs || contentAs === "object") return include;
  if (!include) return ["content"];
  if (include.includes("content")) return include;
  return [...include, "content"];
}

function transformContent<T extends { content?: unknown }>(
  items: T[],
  contentAs: ContentFormat | undefined,
  htmlOptions: RenderOptions | undefined,
  markdownOptions: MarkdownOptions | undefined,
): T[] {
  if (!contentAs || contentAs === "object") return items;
  for (const item of items) {
    if (Array.isArray(item.content)) {
      const blocks = item.content as Block[];
      item.content =
        contentAs === "markdown"
          ? renderBlocksMarkdown(blocks, markdownOptions)
          : renderBlocks(blocks, htmlOptions);
    }
  }
  return items;
}

export function serializeQueryParams(options: QueryOptions): URLSearchParams {
  const params = new URLSearchParams();

  setQueryParam(params, "filter", options.filter || undefined);
  setQueryParam(params, "search", options.search || undefined);
  setQueryParam(params, "sort", options.sort ? serializeSort(options.sort) : undefined);
  setQueryParam(params, "limit", options.limit);
  setQueryParam(params, "offset", options.offset);
  setQueryParam(params, "include", options.include?.length ? options.include.join(",") : undefined);
  setQueryParam(params, "with", options.with && JSON.stringify(options.with));
  setQueryParam(params, "fields", options.fields?.join(","));
  setQueryParam(params, "flat", options.flat ? "true" : undefined);
  setQueryParam(params, "locale", options.locale);
  setQueryParam(params, "fallback", options.fallback);

  return params;
}

function setQueryParam(params: URLSearchParams, name: string, value: unknown): void {
  if (value !== undefined) params.set(name, String(value));
}

function serializeSort(sort: NonNullable<QueryOptions["sort"]>): string {
  const sorts = Array.isArray(sort) ? sort : [sort];
  return sorts
    .map((s) => {
      if (typeof s === "string") return s;
      return s.direction === "desc" ? `-${s.field}` : s.field;
    })
    .join(",");
}
