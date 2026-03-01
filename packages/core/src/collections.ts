/**
 * A collection of items.
 *
 * A collection is a logical grouping of items. It is the target of influxes.
 * It can be shared with consumers.
 **/
import type { CollectionSchema } from "./schemas";

export interface Collection {
  id: string;
  name: string;
  includeRef: boolean;
  schema: CollectionSchema;
}
