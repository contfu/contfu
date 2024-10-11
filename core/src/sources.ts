interface BaseSourceConfig<Collection extends CollectionConfig> {
  type: string;
  collections: Collection[];
}

export interface NotionConfig extends BaseSourceConfig<NotionCollectionConfig> {
  type: "notion";
  key: string;
}

export interface NotionCollectionConfig {
  id: number;
  dbId: string;
  content?: string;
}

export type CollectionConfig = NotionCollectionConfig;

export type SourceConfig = NotionConfig;
