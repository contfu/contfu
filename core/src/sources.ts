interface BaseSourceConfig<Collection extends CollectionConfig> {
  id: number;
  key: string;
  type: string;
  collections: Collection[];
}

export interface NotionConfig extends BaseSourceConfig<NotionCollectionConfig> {
  type: "notion";
  notionKey: string;
}

export interface NotionCollectionConfig {
  id: number;
  dbId: string;
  content?: string;
}

export type CollectionConfig = NotionCollectionConfig;

export type SourceConfig = NotionConfig;
