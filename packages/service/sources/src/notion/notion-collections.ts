import { PropertyType, toCamelCase, type CollectionSchema } from "@contfu/svc-core";
import type { CollectionIcon } from "@contfu/core";
import { isFullDatabase, isFullDataSource } from "@notionhq/client";
import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notion, parseNotionRef } from "./notion-helpers";

export { isFullDataSource };

export async function getCollectionSchema(key: string, id: Buffer) {
  const notionId = parseNotionRef(id);
  const db = await notion.databases.retrieve({
    auth: key,
    database_id: notionId,
  });
  if (!isFullDatabase(db)) {
    throw new Error(`Could not retrieve full database ${notionId}`);
  }

  // In Notion SDK v5+, properties are on the data source, not the database
  const dataSourceId = db.data_sources[0]?.id;
  if (!dataSourceId) {
    throw new Error(`No data sources found for database ${notionId}`);
  }

  const dataSource = await notion.dataSources.retrieve({
    auth: key,
    data_source_id: dataSourceId,
  });
  if (!isFullDataSource(dataSource)) {
    throw new Error(`Could not retrieve data source for database ${notionId}`);
  }

  return notionPropertiesToSchema(dataSource.properties);
}

/**
 * Convert Notion data source properties to a CollectionSchema.
 */
export function notionPropertiesToSchema(
  properties: Record<string, { type: string }>,
): CollectionSchema {
  const schema = {
    cover: PropertyType.FILE | PropertyType.NULL,
    icon: PropertyType.FILE | PropertyType.NULL,
  } as CollectionSchema;
  for (const key in properties) {
    const prop = properties[key];
    const camelKey = toCamelCase(key);
    switch (prop.type) {
      case "title":
      case "rich_text":
      case "url":
      case "email":
      case "phone_number":
      case "status":
      case "select":
        schema[camelKey] = PropertyType.STRING | PropertyType.NULL;
        break;
      case "number":
        schema[camelKey] = PropertyType.NUMBER | PropertyType.NULL;
        break;
      case "date":
        schema[camelKey] = PropertyType.DATE | PropertyType.NULL;
        break;
      case "checkbox":
        schema[camelKey] = PropertyType.BOOLEAN;
        break;
      case "files":
        schema[camelKey] = PropertyType.FILES;
        break;
      case "created_time":
      case "last_edited_time":
        schema[camelKey] = PropertyType.DATE;
        break;
      case "relation":
      case "people":
        schema[camelKey] = PropertyType.REFS;
        break;
      case "created_by":
      case "last_edited_by":
        schema[camelKey] = PropertyType.REF;
        break;
      case "multi_select":
        schema[camelKey] = PropertyType.STRINGS | PropertyType.NULL;
        break;
      case "unique_id":
        schema[camelKey] = PropertyType.STRING;
        break;
      // Skip computed types
      case "formula":
      case "rollup":
        break;
    }
  }
  return schema;
}

/**
 * Extract a CollectionIcon from a Notion data source's icon field.
 */
export function extractNotionIcon(dataSource: DataSourceObjectResponse): CollectionIcon | null {
  const icon = dataSource.icon;
  if (!icon) return null;
  if (icon.type === "emoji") return { type: "emoji", value: icon.emoji };
  if (icon.type === "external") return { type: "image", url: icon.external.url };
  if (icon.type === "file") return { type: "image", url: icon.file.url };
  return null;
}
