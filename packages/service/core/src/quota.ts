export type QuotaState = {
  connections: number;
  maxConnections: number;
  collections: number;
  maxCollections: number;
  flows: number;
  maxFlows: number;
  items: number;
  maxItems: number;
  periodEnd: number;
};
