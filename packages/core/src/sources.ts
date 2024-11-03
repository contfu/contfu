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

export type PullConfig = NotionPullConfig;
