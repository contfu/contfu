import type {
  StrapiContentTypeSchema,
  StrapiEntry,
  StrapiFetchOpts,
  StrapiResponse,
} from "./strapi";

/** Iterate over user-created API content types (uid starts with "api::"). */
export async function* iterateContentTypes(
  url: string,
  token: string,
): AsyncGenerator<StrapiContentTypeSchema> {
  const res = await fetch(`${url.replace(/\/$/, "")}/api/content-type-builder/content-types`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as { data?: StrapiContentTypeSchema[] };
  for (const ct of json.data ?? []) {
    if (ct.uid?.startsWith("api::")) yield ct;
  }
}

/** Default page size for Strapi API requests. */
const DEFAULT_PAGE_SIZE = 25;

/** Build the base API URL for a content type. */
export function buildApiUrl(baseUrl: string, contentType: Buffer): string {
  const uid = contentType.toString("utf8");
  // Extract plural name from UID (e.g., "api::article.article" -> "articles")
  const parts = uid.split(".");
  const singularName = parts[parts.length - 1];
  const pluralName = singularName + "s";
  return `${baseUrl.replace(/\/$/, "")}/api/${pluralName}`;
}

/** Build the content type schema URL. */
export function buildSchemaUrl(baseUrl: string, contentType: Buffer): string {
  const uid = contentType.toString("utf8");
  return `${baseUrl.replace(/\/$/, "")}/api/content-type-builder/content-types/${uid}`;
}

/** Perform a Strapi API request with authentication. */
async function strapiRequest<T>(
  url: string,
  token: Buffer,
  params?: Record<string, string>,
): Promise<T> {
  const queryString = params ? "?" + new URLSearchParams(params).toString() : "";
  const response = await fetch(url + queryString, {
    headers: {
      Authorization: `Bearer ${token.toString("utf8")}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Strapi API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/** Query parameters for fetching Strapi entries. */
export interface StrapiQueryParams {
  page?: number;
  pageSize?: number;
  /** ISO date string for filtering by updatedAt. */
  since?: string;
  /** ISO date string for filtering entries on or before this time. */
  until?: string;
  /** Sort order, defaults to ascending by createdAt. */
  sort?: string;
  /** Populate relations and media. */
  populate?: string;
}

/** Fetch a page of entries from Strapi. */
export async function fetchEntries(
  opts: StrapiFetchOpts,
  params: StrapiQueryParams = {},
): Promise<StrapiResponse<StrapiEntry[]>> {
  const url = buildApiUrl(opts.url, opts.ref);
  const queryParams: Record<string, string> = {
    "pagination[page]": String(params.page ?? 1),
    "pagination[pageSize]": String(params.pageSize ?? DEFAULT_PAGE_SIZE),
    sort: params.sort ?? "createdAt:asc",
    populate: params.populate ?? "*",
  };

  // Add date filters
  if (params.since) {
    queryParams["filters[updatedAt][$gt]"] = params.since;
  }
  if (params.until) {
    queryParams["filters[updatedAt][$lte]"] = params.until;
  }

  return strapiRequest<StrapiResponse<StrapiEntry[]>>(url, opts.credentials, queryParams);
}

/** Iterate through all pages of entries from Strapi. */
export async function* iterateEntries(
  opts: StrapiFetchOpts,
  params: StrapiQueryParams = {},
): AsyncGenerator<StrapiEntry> {
  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchEntries(opts, { ...params, page: currentPage });

    for (const entry of response.data) {
      yield entry;
    }

    hasMore = currentPage < response.meta.pagination.pageCount;
    currentPage++;
  }
}

/** Fetch the content type schema from Strapi. */
export async function fetchContentTypeSchema(
  baseUrl: string,
  contentType: Buffer,
  token: Buffer,
): Promise<StrapiContentTypeSchema> {
  const url = buildSchemaUrl(baseUrl, contentType);
  const response = await strapiRequest<{ data: StrapiContentTypeSchema }>(url, token);
  return response.data;
}

/** Extract media URL from Strapi media object, with optional base URL prefix. */
export function getMediaUrl(url: string, baseUrl?: string): string {
  // If URL is already absolute, return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // Otherwise, prepend the base URL
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}${url}`;
  }
  return url;
}
