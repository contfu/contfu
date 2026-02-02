import { Client, isFullDatabase } from "@notionhq/client";

const notion = new Client({});

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
