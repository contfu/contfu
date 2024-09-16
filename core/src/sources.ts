interface BaseSourceConfig<Collections extends string> {
  id: string;
  key: string;
  type: string;
  collections: Record<Collections, {}>;
}

export interface NotionConfig<Collections extends string>
  extends BaseSourceConfig<Collections> {
  type: "notion";
  notionKey: string;
  collections: Record<Collections, NotionCollectionConfig>;
}

export interface NotionCollectionConfig {
  dbId: string;
  content?: string;
}

export type SourceConfig<C extends string = string> = NotionConfig<C>;
