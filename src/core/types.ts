import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Schema {
  connection: ConnectionTable;
  page: PageTable;
  pageLink: PageLinkTable;
  component: ComponentTable;
  pageComponent: PageComponentTable;
  componentRelation: ComponentRelationTable;
  sync: SyncTable;
}

export interface ConnectionTable {
  id: Generated<number>;
  name: string;
  key: string;
  target: string;
  type: string;
  createdAt: number;
}
export type Connection = Selectable<ConnectionTable>;
export type NewConnection = Insertable<ConnectionTable>;
export type ConnectionUpdate = Updateable<ConnectionTable>;

export interface PageTable {
  id: Generated<number>;
  ref: string;
  slug: string;
  type: string | null;
  title: string;
  description: string;
  content: string;
  attributes: string;
  author: string | null;
  connection: number;
  publishedAt: number;
  createdAt: number;
  updatedAt: number | null;
  changedAt: number;
}
export type Page = Selectable<PageTable>;
export type NewPage = Insertable<PageTable>;
export type PageUpdate = Updateable<PageTable>;

export interface PageLinkTable {
  type: string;
  from: number;
  to: number;
}
export type PageLink = Selectable<PageLinkTable>;
export type NewPageLink = Insertable<PageLinkTable>;
export type PageLinkUpdate = Updateable<PageLinkTable>;

export interface ComponentTable {
  id: Generated<number>;
  ref: string;
  name: string;
  props: string;
  content: string;
  changedAt: number;
  createdAt: number;
}
export type Component = Selectable<ComponentTable>;
export type NewComponent = Insertable<ComponentTable>;
export type ComponentUpdate = Updateable<ComponentTable>;

export interface PageComponentTable {
  pageId: number;
  componentId: number;
}
export type PageComponent = Selectable<PageComponentTable>;
export type NewPageComponent = Insertable<PageComponentTable>;
export type PageComponentUpdate = Updateable<PageComponentTable>;

export interface ComponentRelationTable {
  parentId: number;
  childId: number;
}
export type ComponentRelation = Selectable<ComponentRelationTable>;
export type NewComponentRelation = Insertable<ComponentRelationTable>;
export type ComponentRelationUpdate = Updateable<ComponentRelationTable>;

export interface SyncTable {
  connection: number;
  full: number | null;
  changes: number | null;
  orphans: number | null;
}
export type Sync = Selectable<SyncTable>;
export type NewSync = Insertable<SyncTable>;
export type SyncUpdate = Updateable<SyncTable>;
