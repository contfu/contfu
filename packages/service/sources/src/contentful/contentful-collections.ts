import { CollectionSchema, PropertyType } from "@contfu/svc-core";
import { fetchContentType } from "./contentful-helpers";
import type { ContentfulContentTypeField } from "./contentful";

export async function getCollectionSchema(
  spaceId: string,
  environmentId: string,
  contentTypeId: Buffer,
  credentials: Buffer,
): Promise<CollectionSchema> {
  const contentType = await fetchContentType(
    spaceId,
    environmentId,
    contentTypeId.toString("utf8"),
    credentials.toString("utf8"),
  );
  return convertSchema(contentType.fields);
}

function convertSchema(fields: ContentfulContentTypeField[]): CollectionSchema {
  const result: CollectionSchema = {};

  for (const field of fields) {
    if (field.omitted || field.disabled) continue;

    const propertyType = mapFieldType(field);
    if (propertyType !== null) {
      result[field.id] = propertyType;
    }
  }

  return result;
}

function mapFieldType(field: ContentfulContentTypeField): number | null {
  const required = field.required === true;

  switch (field.type) {
    case "Symbol":
    case "Text":
      return required ? PropertyType.STRING : PropertyType.STRING | PropertyType.NULL;

    case "Array": {
      const validations = field.validations ?? [];
      const linkValidation = validations.find((v) => "linkContentType" in v);
      if (linkValidation && "linkContentType" in linkValidation) {
        return PropertyType.REFS;
      }
      return PropertyType.STRINGS;
    }

    case "Integer":
    case "Number":
      return required ? PropertyType.NUMBER : PropertyType.NUMBER | PropertyType.NULL;

    case "Boolean":
      return PropertyType.BOOLEAN;

    case "Date":
      return required ? PropertyType.DATE : PropertyType.DATE | PropertyType.NULL;

    case "Link":
      return PropertyType.REF;

    case "Location":
      return PropertyType.STRING;

    case "RichText":
      return null;

    case "Object":
      return PropertyType.STRING;

    default:
      return null;
  }
}
