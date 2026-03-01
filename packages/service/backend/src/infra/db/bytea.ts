import type { CollectionSchema, Filter } from "@contfu/svc-core";
import type { SchemaIncompatibleDetails } from "@contfu/svc-core";
import {
  type sourceCollectionTable,
  type influxTable,
  type incidentTable,
  sourceCollectionTable as sourceCollectionTableVal,
  influxTable as influxTableVal,
  incidentTable as incidentTableVal,
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
  source_collection: {
    schema: "msgpackr" as const,
    itemIds: "msgpackr" as const,
  },
  influx: {
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
  source_collection: {
    schema: CollectionSchema;
    itemIds: Uint8Array;
  };
  influx: {
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
  source_collection: sourceCollectionTableVal,
  influx: influxTableVal,
  incident: incidentTableVal,
} as const;
