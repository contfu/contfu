import { Client, iteratePaginatedAPI } from "@notionhq/client";
import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({});

export type DataSourceResult = DataSourceObjectResponse;

/**
 * Check if a search result is a full data source object.
 */
function isFullDataSource(result: unknown): result is DataSourceObjectResponse {
  return (
    typeof result === "object" &&
    result !== null &&
    "object" in result &&
    (result as { object: string }).object === "data_source" &&
    "title" in result
  );
}

/**
 * Search for all data sources accessible to the integration using pagination.
 */
export async function* iterateDataSources(auth: string) {
  for await (const result of iteratePaginatedAPI(notion.search, {
    auth,
    filter: { property: "object", value: "data_source" },
  })) {
    if (isFullDataSource(result)) yield result;
  }
}
