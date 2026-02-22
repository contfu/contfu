import { Client, isFullDatabase, isFullPage, iteratePaginatedAPI } from "@notionhq/client";
import type {
  DataSourceObjectResponse,
  QueryDataSourceParameters,
} from "@notionhq/client/build/src/api-endpoints";

export const notion = new Client(
  process.env.NOTION_BASE_URL ? { baseUrl: process.env.NOTION_BASE_URL } : {},
);

export type DbQuery = Partial<Omit<QueryDataSourceParameters, "data_source_id" | "auth">>;

export type DataSourceResult = DataSourceObjectResponse;

/**
 * Search for all data sources accessible to the integration using pagination.
 */
export async function* iterateDataSources(auth: string) {
  for await (const result of iteratePaginatedAPI(notion.search, {
    auth,
    filter: { property: "object", value: "data_source" },
  })) {
    if (result.object === "data_source") yield result as DataSourceResult;
  }
}

/**
 * Resolve any ID (database or data source) to a data source ID.
 * Useful when users may provide either format.
 */
export async function resolveDataSourceId(auth: string, id: string): Promise<string> {
  // First try to retrieve as a data source directly
  try {
    const ds = await notion.dataSources.retrieve({ auth, data_source_id: id });
    if (ds && typeof ds === "object" && "id" in ds && typeof ds.id === "string") {
      return ds.id;
    }
  } catch {
    // Not a data source ID, try as database ID
  }

  // Retrieve database to get its data source
  const db = await notion.databases.retrieve({ auth, database_id: id });
  if (!isFullDatabase(db)) {
    throw new Error("Could not retrieve database");
  }
  const dataSourceId = db.data_sources[0]?.id;
  if (!dataSourceId) {
    throw new Error(`No data sources found for database ${id}`);
  }
  return dataSourceId;
}

export async function* iterateDb(key: string, ref: Buffer, params?: DbQuery) {
  const rawId = parseNotionRef(ref);
  const dataSourceId = await resolveDataSourceId(key, rawId);

  for await (const pageObj of iteratePaginatedAPI(notion.dataSources.query, {
    auth: key,
    data_source_id: dataSourceId,
    ...params,
  })) {
    if (pageObj.object === "page" && isFullPage(pageObj)) yield pageObj;
  }
}

/** Parse a stored source collection ref into a Notion database/data source ID. */
export function parseNotionRef(ref: Buffer): string {
  if (ref.length === 16) {
    const asciiLike = [...ref].every((byte) => byte >= 32 && byte <= 126);
    if (!asciiLike) {
      return ref.toString("hex");
    }
  }

  const utf8 = sanitizeId(ref.toString("utf8"));
  if (/^[0-9a-fA-F-]{32,36}$/.test(utf8)) {
    return utf8.replace(/-/g, "");
  }

  return utf8;
}

function sanitizeId(id: string): string {
  return id.trim().replace(/^["'`]+|["'`]+$/g, "");
}

type Image =
  | { type?: "file"; file: { url: string } }
  | { type?: "external"; external: { url: string } };

export function getImageUrl(img: Required<Image>): string;
export function getImageUrl(img: Image): string | undefined;
export function getImageUrl(img: Image): string | undefined {
  if (img.type === "file") return img.file.url;
  if (img.type === "external") return img.external.url;
  return undefined;
}
