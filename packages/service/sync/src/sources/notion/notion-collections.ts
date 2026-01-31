import { CollectionSchema, PropertyType } from "@contfu/core";
import { notion } from "./notion-helpers";

export async function getCollectionSchema(key: string, id: Buffer) {
  const db = await notion.databases.retrieve({
    auth: key,
    database_id: id.toString("hex"),
  });
  const schema = {
    cover: PropertyType.FILE | PropertyType.NULL,
    icon: PropertyType.FILE | PropertyType.NULL,
  } as CollectionSchema;
  for (const key in db.properties) {
    const prop = db.properties[key];
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
      case "verification":
        schema[key] = PropertyType.STRING | PropertyType.NULL;
        break;
      // Skip computed types
      case "formula":
      case "rollup":
      case "button":
        break;
    }
  }
  return schema;
}
