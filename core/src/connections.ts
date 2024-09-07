interface BaseConnectionConfig<Collections extends string> {
  id: string;
  key: string;
  type: string;
  collections: Record<Collections, {}>;
}

export interface NotionConnectionConfig<Collections extends string>
  extends BaseConnectionConfig<Collections> {
  type: "notion";
  notionKey: string;
  collections: Record<Collections, NotionCollectionConfig>;
}

export interface NotionCollectionConfig {
  dbId: string;
}

export type ConnectionConfig<C extends string = string> =
  NotionConnectionConfig<C>;

export function createConnection<C extends string>(
  connection: ConnectionConfig<C>
) {
  return connection;
}

const conn = createConnection({
  id: "id",
  key: "key",
  type: "notion",
  notionKey: "notionKey",
  collections: { collection1: { dbId: "dbId" } },
});
