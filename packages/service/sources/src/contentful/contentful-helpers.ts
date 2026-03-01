import type {
  ContentfulAsset,
  ContentfulContentType,
  ContentfulEntry,
  ContentfulFetchOpts,
  ContentfulResponse,
} from "./contentful";

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_ENVIRONMENT = "master";

export interface ContentfulQueryParams {
  limit?: number;
  skip?: number;
  order?: string;
  content_type?: string;
  "sys.updatedAt[gte]"?: string;
  "sys.updatedAt[lte]"?: string;
}

export function buildContentTypeUrl(
  spaceId: string,
  environmentId: string,
  contentTypeId: string,
): string {
  return `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${contentTypeId}`;
}

export function buildEntriesUrl(spaceId: string, environmentId: string): string {
  return `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;
}

async function contentfulRequest<T>(
  url: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> {
  const queryString = params ? "?" + new URLSearchParams(params).toString() : "";
  const response = await fetch(url + queryString, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json-patch+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Contentful API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchContentType(
  spaceId: string,
  environmentId: string,
  contentTypeId: string,
  token: string,
): Promise<ContentfulContentType> {
  const url = buildContentTypeUrl(spaceId, environmentId, contentTypeId);
  const response = await contentfulRequest<{
    sys: ContentfulContentType["sys"];
    name: string;
    fields: ContentfulContentType["fields"];
  }>(url, token);

  return {
    sys: response.sys,
    name: response.name,
    fields: response.fields,
  };
}

export async function fetchEntries(
  opts: ContentfulFetchOpts,
  params: ContentfulQueryParams = {},
): Promise<ContentfulResponse<ContentfulEntry>> {
  const env = opts.environmentId ?? DEFAULT_ENVIRONMENT;
  const url = buildEntriesUrl(opts.spaceId, env);
  const contentType = opts.ref.toString("utf8");

  const queryParams: Record<string, string> = {
    limit: String(params.limit ?? DEFAULT_PAGE_SIZE),
    skip: String(params.skip ?? 0),
    order: params.order ?? "sys.createdAt",
    content_type: contentType,
    include: "10",
  };

  if (params["sys.updatedAt[gte]"]) {
    queryParams["sys.updatedAt[gte]"] = params["sys.updatedAt[gte]"];
  }
  if (params["sys.updatedAt[lte]"]) {
    queryParams["sys.updatedAt[lte]"] = params["sys.updatedAt[lte]"];
  }

  return contentfulRequest<ContentfulResponse<ContentfulEntry>>(
    url,
    opts.credentials.toString("utf8"),
    queryParams,
  );
}

export async function* iterateEntries(
  opts: ContentfulFetchOpts,
  params: ContentfulQueryParams = {},
): AsyncGenerator<ContentfulEntry> {
  let skip = params.skip ?? 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchEntries(opts, { ...params, skip });

    for (const entry of response.items) {
      yield entry;
    }

    const total = response.sys.total ?? 0;
    hasMore = skip + response.items.length < total;
    skip += response.items.length;
  }
}

export function getLinkedEntry(
  response: ContentfulResponse<ContentfulEntry>,
  linkId: string,
): ContentfulEntry | undefined {
  return response.includes?.Entry?.find((e) => e.sys.id === linkId);
}

export function getLinkedAsset(
  response: ContentfulResponse<ContentfulEntry>,
  linkId: string,
): ContentfulAsset | undefined {
  return response.includes?.Asset?.find((a) => a.sys.id === linkId);
}
