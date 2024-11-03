interface BaseSourcePullConfig {
  type: string;
  accountId: number;
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
