import { PropertyType, type CollectionSchema } from "@contfu/core";

export type SanitySchemaSyncPayload = {
  dataset: string;
  environment: string;
  schemas: Record<string, CollectionSchema>;
};

const SCHEMA_SYNC_PATH = "/webhooks/sanity/schema";
const DEFAULT_CONTFU_ORIGIN = "https://contfu.com";

export type UpdateContfuSchemaOptions = {
  webhookSecret: string;
  dataset: string;
  schemaTypes: SanitySchemaDefinition[];
  signal?: AbortSignal;
};

/** @deprecated Use UpdateContfuSchemaOptions. */
export type UpdateConftuSchemaOptions = UpdateContfuSchemaOptions;

export function updateContfuSchema(options: UpdateContfuSchemaOptions): Promise<Response> {
  return fetch(getSchemaSyncEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${options.webhookSecret}`,
    },
    body: JSON.stringify(buildSanitySchemaSyncPayload(options.dataset, options.schemaTypes)),
    signal: options.signal,
  });
}

/** @deprecated Use updateContfuSchema. */
export const updateConftuSchema = updateContfuSchema;

export function buildSanitySchemaSyncPayload(
  dataset: string,
  schemaTypes: SanitySchemaDefinition[],
): SanitySchemaSyncPayload {
  const objectTypeNames = new Set(
    schemaTypes.flatMap((schema) =>
      schema.type === "object" && typeof schema.name === "string" ? [schema.name] : [],
    ),
  );
  const schemas: Record<string, CollectionSchema> = {};
  for (const document of schemaTypes) {
    if (document.type !== "document" || typeof document.name !== "string") continue;
    schemas[document.name] = normalizeDocumentSchema(document, objectTypeNames);
  }
  return { dataset, environment: dataset, schemas };
}

function normalizeDocumentSchema(
  document: SanitySchemaDefinition,
  objectTypeNames: ReadonlySet<string>,
): CollectionSchema {
  const schema: CollectionSchema = { $draft: PropertyType.BOOLEAN };
  for (const field of Array.isArray(document.fields) ? document.fields : []) {
    if (typeof field.name !== "string") continue;
    const type = normalizeFieldType(field, objectTypeNames);
    if (type !== null) schema[field.name] = applyNullability(type, field);
  }
  return schema;
}

function normalizeFieldType(
  field: SanityFieldDefinition,
  objectTypeNames: ReadonlySet<string>,
): number | null {
  if (typeof field.type !== "string") return null;
  if (field.type === "string" || field.type === "text" || field.type === "slug")
    return PropertyType.STRING;
  if (field.type === "url" || field.type === "email") return PropertyType.STRING;
  if (field.type === "number") return PropertyType.NUMBER;
  if (field.type === "color") return PropertyType.COLOR;
  if (field.type === "boolean") return PropertyType.BOOLEAN;
  if (field.type === "datetime" || field.type === "date") return PropertyType.DATE;
  if (field.type === "geopoint") return PropertyType.GEOPOINT;
  if (field.type === "reference") return PropertyType.REF;
  if (field.type === "image" || field.type === "file") return PropertyType.FILE;
  if (field.type === "block") return PropertyType.BLOCK;
  if (field.type === "object") return PropertyType.JSON;
  if (field.type === "array") return normalizeArrayType(field.of, objectTypeNames);
  return PropertyType.STRING;
}

function applyNullability(type: number, field: SanityFieldDefinition): number {
  return isRequiredField(field) ? type : type | PropertyType.NULL;
}

function isRequiredField(field: SanityFieldDefinition): boolean {
  if (typeof field.validation !== "function") return false;
  let required = false;
  const rule = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === "required") {
          return () => {
            required = true;
            return rule;
          };
        }
        return () => rule;
      },
    },
  );
  try {
    field.validation(rule);
  } catch {
    return false;
  }
  return required;
}

function normalizeArrayType(of: unknown, objectTypeNames: ReadonlySet<string>): number {
  const items = Array.isArray(of) ? (of as SanityFieldDefinition[]) : [];
  let result = PropertyType.NULL;
  for (const item of items) {
    const type = normalizeFieldType(item, objectTypeNames);
    if (type === null) continue;
    if (type & PropertyType.REF) return PropertyType.REFS;
    if (type & PropertyType.BLOCK) return PropertyType.BLOCK;
    if (type & PropertyType.FILE) return PropertyType.FILES;
    if (
      type & PropertyType.JSON ||
      (typeof item.type === "string" && objectTypeNames.has(item.type))
    )
      return PropertyType.JSON;
    if (type & PropertyType.NUMBER) result |= PropertyType.NUMBERS;
    else result |= PropertyType.STRINGS;
  }
  return result === PropertyType.NULL ? PropertyType.STRINGS : result;
}

function getSchemaSyncEndpoint(): string {
  const configured = process.env.CONTFU_ORIGIN?.trim() || DEFAULT_CONTFU_ORIGIN;
  return `${configured.replace(/\/$/, "")}${SCHEMA_SYNC_PATH}`;
}

export type SanitySchemaDefinition = {
  name?: unknown;
  type?: unknown;
  fields?: unknown;
  [key: string]: unknown;
};

type SanityFieldDefinition = {
  name?: unknown;
  type?: unknown;
  of?: unknown;
  validation?: unknown;
  [key: string]: unknown;
};
