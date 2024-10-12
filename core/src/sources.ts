interface BaseSourceConfig<Collection extends CollectionConfig> {
  type: string;
  collections: Collection[];
}

export interface NotionConfig extends BaseSourceConfig<NotionCollectionConfig> {
  type: "notion";
  key: Buffer;
}

export interface NotionCollectionConfig {
  id: number;
  dbId: Buffer;
  content?: string;
  lastFetch?: number;
}

export type CollectionConfig = NotionCollectionConfig;

export type SourceConfig = NotionConfig;
