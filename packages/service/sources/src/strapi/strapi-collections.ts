import {
  type CollectionSchema,
  type SchemaValue,
  PropertyType,
  toCamelCase,
} from "@contfu/svc-core";
import { fetchContentTypeSchema } from "./strapi-helpers";
import type { StrapiSchemaAttribute } from "./strapi";

/**
 * Fetch and convert Strapi content type schema to CollectionSchema.
 */
export async function getCollectionSchema(
  baseUrl: string,
  contentType: Buffer,
  token: Buffer,
): Promise<CollectionSchema> {
  const schema = await fetchContentTypeSchema(baseUrl, contentType, token);
  return convertSchema(schema.attributes);
}

/**
 * Convert Strapi schema attributes to CollectionSchema.
 */
function convertSchema(attributes: Record<string, StrapiSchemaAttribute>): CollectionSchema {
  const result: CollectionSchema = {};

  for (const [key, attr] of Object.entries(attributes)) {
    const propertyType = mapAttributeType(attr);
    if (propertyType !== null) {
      result[toCamelCase(key)] = propertyType;
    }
  }

  return result;
}

/**
 * Map a Strapi attribute type to a SchemaValue.
 */
function mapAttributeType(attr: StrapiSchemaAttribute): SchemaValue | null {
  const nullable = attr.required !== true;

  switch (attr.type) {
    // Text types
    case "string":
    case "text":
    case "richtext":
    case "email":
    case "uid":
      return nullable ? PropertyType.STRING | PropertyType.NULL : PropertyType.STRING;

    case "enumeration": {
      const baseType = nullable ? PropertyType.ENUM | PropertyType.NULL : PropertyType.ENUM;
      return [baseType, attr.enum ?? []];
    }

    // Numeric types
    case "integer":
    case "biginteger":
    case "float":
    case "decimal":
      return nullable ? PropertyType.NUMBER | PropertyType.NULL : PropertyType.NUMBER;

    // Boolean
    case "boolean":
      return PropertyType.BOOLEAN;

    // Date types
    case "date":
    case "datetime":
    case "time":
      return nullable ? PropertyType.DATE | PropertyType.NULL : PropertyType.DATE;

    // Media
    case "media":
      if (attr.multiple) {
        return PropertyType.FILES;
      }
      return nullable ? PropertyType.FILE | PropertyType.NULL : PropertyType.FILE;

    // Relations
    case "relation":
      return mapRelationType(attr);

    // Blocks (rich text) - stored as content, not property
    case "blocks":
      return null;

    // Components
    case "component":
      // Components are serialized; treat as strings
      if (attr.repeatable) {
        return PropertyType.STRINGS;
      }
      return nullable ? PropertyType.STRING | PropertyType.NULL : PropertyType.STRING;

    // Dynamic zones (array of components)
    case "dynamiczone":
      return PropertyType.STRINGS;

    // JSON
    case "json":
      return nullable ? PropertyType.STRING | PropertyType.NULL : PropertyType.STRING;

    default:
      return null;
  }
}

/**
 * Map a Strapi relation type to a PropertyType.
 */
function mapRelationType(attr: StrapiSchemaAttribute): number {
  const relation = attr.relation ?? "";
  const nullable = attr.required !== true;

  // Check if it's a to-many relation
  const isToMany =
    relation === "oneToMany" || relation === "manyToMany" || relation.endsWith("ToMany");

  if (isToMany) {
    return PropertyType.REFS;
  }

  // To-one relations
  return nullable ? PropertyType.REF | PropertyType.NULL : PropertyType.REF;
}
