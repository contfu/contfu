export interface ProductQuota {
  maxConnections: number;
  maxCollections: number;
  maxFlows: number;
  maxItems: number;
}

export const FREE_QUOTA: ProductQuota = {
  maxConnections: 2,
  maxCollections: 5,
  maxFlows: 5,
  maxItems: 100,
};

const STARTER_QUOTA: ProductQuota = {
  maxConnections: 5,
  maxCollections: 15,
  maxFlows: 30,
  maxItems: 1_000,
};

const PRO_QUOTA: ProductQuota = {
  maxConnections: 15,
  maxCollections: 50,
  maxFlows: 100,
  maxItems: 10_000,
};

const BUSINESS_QUOTA: ProductQuota = {
  maxConnections: 100,
  maxCollections: 500,
  maxFlows: 1000,
  maxItems: 100_000,
};

export const PRODUCT_QUOTAS: Record<string, ProductQuota> = {
  // Starter monthly
  "bebd5fad-e647-47db-9052-3167f81f14d3": STARTER_QUOTA,
  // Starter yearly
  "9f177026-9631-4f1d-a22c-9f3f616589e2": STARTER_QUOTA,
  // Pro monthly
  "c36e30b0-a654-4c39-9b8d-049be7dfd49a": PRO_QUOTA,
  // Pro yearly
  "58148e9c-5025-4b4a-9255-fa8b47be98ce": PRO_QUOTA,
  // Business monthly
  "e3d96e4b-2c14-4b90-b56e-7efed5d16b83": BUSINESS_QUOTA,
  // Business yearly
  "4ec0456a-0981-4611-8532-31cc94ac3e87": BUSINESS_QUOTA,
};

export function getQuotaForProduct(productId: string | null): ProductQuota {
  if (!productId) return FREE_QUOTA;
  return PRODUCT_QUOTAS[productId] ?? FREE_QUOTA;
}
