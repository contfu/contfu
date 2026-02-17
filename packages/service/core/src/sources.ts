interface BaseSourcePullConfig {
  type: string;
  userId: number;
  sourceId: number;
  collectionId: number;
  since?: number;
}

export interface NotionPullConfig extends BaseSourcePullConfig {
  type: "notion";
  apiKey: Buffer;
  dbId: Buffer;
}

export interface StrapiPullConfig extends BaseSourcePullConfig {
  type: "strapi";
  apiToken: Buffer;
  url: string;
  contentType: Buffer;
}

export type PullConfig = NotionPullConfig | StrapiPullConfig;
