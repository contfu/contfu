import { QueryResultArray, renderBlocks, renderBlocksMarkdown } from "@contfu/core";
import type {
  Block,
  ContentFormat,
  MarkdownOptions,
  QueryMeta,
  QueryOptions,
  RenderOptions,
  WithClause,
} from "@contfu/core";
import {
  all,
  and,
  contains,
  createItemRef,
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
};

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

  function normalizeArgs(
    first?: string | Record<string, any>,
    second?: any,
  ): { options: Record<string, any> } {
    if (typeof first === "string") {
      if (second == null) return { options: { collection: first } };
      if (typeof second === "string" || typeof second === "function") {
        return { options: { collection: first, filter: second } };
      }
      return { options: { collection: first, ...second } };
    }
    return { options: first ?? {} };
  }

  function resolveFilter(filter: unknown): string | undefined {
    if (typeof filter === "function") return filter(createItemRef(0));
    return filter as string | undefined;
  }

  const callable = async (first?: any, second?: any) => {
    const { options } = normalizeArgs(first, second);
    const { collection, contentAs, htmlOptions, markdownOptions, locale, fallback, ...rest } =
      options as QueryOptions & {
        collection?: string;
      };
    const filter = resolveFilter(rest.filter);
    const resolvedWith =
      rest.with && typeof rest.with === "function" ? resolveWithFunctions(rest.with, 1) : rest.with;
    const include = resolveInclude(rest.include, contentAs);
    const effectiveLocale = locale ?? scope.locale;
    const effectiveFallback = resolveFallbackParam(
      fallback !== undefined ? fallback : scope.fallback,
      scope.defaultLocale,
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
): string | true | false | undefined {
  if (fallback === true) return defaultLocale ?? true;
  return fallback;
}

function resolveWithFunctions(withVal: any, parentLevel: number): WithClause {
  let entries: Record<string, any>;
  if (typeof withVal === "function") {
    entries = withVal(createItemRef(parentLevel));
  } else {
    entries = withVal;
  }

  const result: WithClause = {};
  for (const [name, entry] of Object.entries(entries)) {
    let filter: string | undefined;
    if (typeof entry.filter === "function") {
      filter = entry.filter(createItemRef(0));
    } else {
      filter = entry.filter;
    }
    result[name] = {
      collection: entry.collection,
      filter,
      limit: entry.limit,
      include: entry.include,
      single: entry.single,
      with: entry.with ? resolveWithFunctions(entry.with, parentLevel + 1) : undefined,
    };
  }
  return result;
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

  if (options.filter) params.set("filter", options.filter);
  if (options.search) params.set("search", options.search);

  if (options.sort) {
    const sorts = Array.isArray(options.sort) ? options.sort : [options.sort];
    const sortStr = sorts
      .map((s) => {
        if (typeof s === "string") return s;
        return s.direction === "desc" ? `-${s.field}` : s.field;
      })
      .join(",");
    params.set("sort", sortStr);
  }

  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  if (options.include?.length) params.set("include", options.include.join(","));
  if (options.with) params.set("with", JSON.stringify(options.with));
  if (options.fields !== undefined) params.set("fields", options.fields.join(","));
  if (options.locale !== undefined) params.set("locale", String(options.locale));
  if (options.fallback !== undefined) params.set("fallback", String(options.fallback));

  return params;
}
