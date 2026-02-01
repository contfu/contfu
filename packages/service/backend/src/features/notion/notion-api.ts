import { Client, isFullDatabase, iteratePaginatedAPI } from "@notionhq/client";
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

/**
 * Resolve any ID (database or data source) to a data source ID.
 * Useful when users may provide either format.
 */
export async function resolveDataSourceId(auth: string, id: string): Promise<string> {
  // First try to retrieve as a data source directly
  try {
    const ds = await notion.dataSources.retrieve({ auth, data_source_id: id });
    return ds.id;
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
