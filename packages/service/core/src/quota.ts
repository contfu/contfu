export type QuotaState = {
  sources: number;
  maxSources: number;
  collections: number;
  maxCollections: number;
  items: number;
  maxItems: number;
  consumers: number;
  maxConsumers: number;
  periodEnd: number;
};
