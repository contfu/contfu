import type { Collection } from "@contfu/core";
import type { CollectionI18nConfig, EffectiveCollectionI18nConfig } from "./i18n";
import type { CollectionSchema } from "./schemas";

export interface ServiceCollection extends Collection {
  displayName: string;
  schema: CollectionSchema;
  hasRef: boolean;
  refString: string | null;
  integrationId: string | null;
  integrationName: string | null;
  integrationType: number | null;
  i18n?: CollectionI18nConfig;
  effectiveI18n?: EffectiveCollectionI18nConfig;
  itemsCount: number;
  sourceSyncStatus: number;
  stale: boolean;
  staleReason: number | null;
  staleAt: Date | null;
  fullPullRequired: boolean;
  sourceRepairGeneration: number | null;
  sourceRepairStartedAt: Date | null;
  flowSourceCount: number;
  flowTargetCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}
