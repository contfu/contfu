import type { CollectionSchema, Filter, SchemaIncompatibleDetails } from "@contfu/svc-core";
import {
  incidentTable as incidentTableVal,
  flowTable as flowTableVal,
  collectionTable as collectionTableVal,
} from "./schema";

/**
 * Encoding type for blob columns.
 * NOTE: When adding new encoded columns to the schema, you MUST update:
 * - columnEncodings below (to specify how the data is encoded)
 * - ColumnTypes interface (to specify the decoded TypeScript type)
 */
export type Encoding = "msgpackr" | "jsonb";

/**
 * Maps table/column to their encoding type.
 * Must be kept in sync with ColumnTypes below.
 */
export const columnEncodings = {
  collection: {
    schema: "msgpackr" as const,
  },
  flow: {
    schema: "msgpackr" as const,
    filters: "msgpackr" as const,
  },
  incident: {
    details: "msgpackr" as const,
  },
};

/**
 * Maps table/column to their decoded TypeScript type.
 * Must be kept in sync with columnEncodings above.
 */
export interface ColumnTypes {
  collection: {
    schema: CollectionSchema;
  };
  flow: {
    schema: CollectionSchema;
    filters: Filter[];
  };
  incident: {
    details: SchemaIncompatibleDetails;
  };
}

export type TableName = keyof ColumnTypes;
export type ColumnName<T extends TableName> = keyof ColumnTypes[T];
export type ColumnType<T extends TableName, C extends ColumnName<T>> = ColumnTypes[T][C];

export const tables = {
  collection: collectionTableVal,
  flow: flowTableVal,
  incident: incidentTableVal,
} as const;
