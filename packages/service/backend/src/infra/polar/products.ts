export interface ProductQuota {
  maxSources: number;
  maxCollections: number;
  maxItems: number;
  maxConsumers: number;
}

export const FREE_QUOTA: ProductQuota = {
  maxSources: 1,
  maxCollections: 5,
  maxItems: 100,
  maxConsumers: 1,
};

export const PRODUCT_QUOTAS: Record<string, ProductQuota> = {
  // Starter (monthly and yearly share same quota)
  "bebd5fad-e647-47db-9052-3167f81f14d3": {
    maxSources: 3,
    maxCollections: 15,
    maxItems: 1000,
    maxConsumers: 2,
  },
  "9f177026-9631-4f1d-a22c-9f3f616589e2": {
    maxSources: 3,
    maxCollections: 15,
    maxItems: 1000,
    maxConsumers: 2,
  },
  // Pro (monthly and yearly share same quota)
  "c36e30b0-a654-4c39-9b8d-049be7dfd49a": {
    maxSources: 10,
    maxCollections: 50,
    maxItems: 10000,
    maxConsumers: 5,
  },
  "58148e9c-5025-4b4a-9255-fa8b47be98ce": {
    maxSources: 10,
    maxCollections: 50,
    maxItems: 10000,
    maxConsumers: 5,
  },
  // Business (monthly and yearly share same quota)
  "e3d96e4b-2c14-4b90-b56e-7efed5d16b83": {
    maxSources: -1,
    maxCollections: -1,
    maxItems: 100000,
    maxConsumers: 50,
  },
  "4ec0456a-0981-4611-8532-31cc94ac3e87": {
    maxSources: -1,
    maxCollections: -1,
    maxItems: 100000,
    maxConsumers: 50,
  },
};

export function getQuotaForProduct(productId: string | null): ProductQuota {
  if (!productId) return FREE_QUOTA;
  return PRODUCT_QUOTAS[productId] ?? FREE_QUOTA;
}
