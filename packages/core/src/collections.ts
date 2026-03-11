/**
 * A collection of items.
 *
 * A collection is a logical grouping of items. It is the target of influxes.
 * It can be shared with consumers.
 **/
import type { CollectionSchema, RefTargets } from "./schemas";

export type CollectionIcon = { type: "emoji"; value: string } | { type: "image"; url: string };

export interface Collection {
  id: string;
  name: string;
  includeRef: boolean;
  schema: CollectionSchema;
  refTargets?: RefTargets;
  icon?: CollectionIcon | null;
}
