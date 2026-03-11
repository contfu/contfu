import type { Collection } from "@contfu/core";
import type { CollectionSchema } from "./schemas";

export interface ServiceCollection extends Collection {
  displayName: string;
  schema: CollectionSchema;
  hasRef: boolean;
  refString: string | null;
  connectionId: string | null;
  connectionName: string | null;
  connectionType: number | null;
  flowSourceCount: number;
  flowTargetCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}
