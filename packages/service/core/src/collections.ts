import type { Collection } from "@contfu/core";
import type { CollectionSchema } from "./schemas";

export interface ServiceCollection extends Collection {
  displayName: string;
  schema: CollectionSchema;
  influxCount: number;
  connectionCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}
