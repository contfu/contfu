import { CollectionSchema, PropertyType } from "@contfu/core";

/**
 * Convert Notion data source properties to a CollectionSchema.
 * This is the same mapping used in the sync service.
 */
export function notionPropertiesToSchema(
  properties: Record<string, { type: string }>,
): CollectionSchema {
  const schema: CollectionSchema = {
    cover: PropertyType.FILE | PropertyType.NULL,
    icon: PropertyType.FILE | PropertyType.NULL,
  };

  for (const key in properties) {
    const prop = properties[key];
    switch (prop.type) {
      case "title":
      case "rich_text":
      case "url":
      case "email":
      case "phone_number":
      case "status":
      case "select":
        schema[key] = PropertyType.STRING | PropertyType.NULL;
        break;
      case "number":
        schema[key] = PropertyType.NUMBER | PropertyType.NULL;
        break;
      case "date":
        schema[key] = PropertyType.DATE | PropertyType.NULL;
        break;
      case "checkbox":
        schema[key] = PropertyType.BOOLEAN;
        break;
      case "files":
        schema[key] = PropertyType.FILES;
        break;
      case "created_time":
      case "last_edited_time":
        schema[key] = PropertyType.DATE;
        break;
      case "relation":
      case "people":
        schema[key] = PropertyType.REFS;
        break;
      case "created_by":
      case "last_edited_by":
        schema[key] = PropertyType.REF;
        break;
      case "multi_select":
        schema[key] = PropertyType.STRINGS | PropertyType.NULL;
        break;
      case "unique_id":
        schema[key] = PropertyType.STRING;
        break;
      // Skip computed types (formula, rollup)
    }
  }
  return schema;
}
