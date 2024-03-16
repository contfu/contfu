import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Schema {
  connection: ConnectionTable;
  page: PageTable;
  pageLink: PageLinkTable;
  component: ComponentTable;
  pageComponent: PageComponentTable;
  componentRelation: ComponentRelationTable;
}

export interface ConnectionTable {
  name: string;
  key: string;
  target: string;
  type: string;
}
export type DbConnection = Selectable<ConnectionTable>;
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
export type DbPage = Selectable<PageTable>;
export type NewPage = Insertable<PageTable>;
export type PageUpdate = Updateable<PageTable>;

export interface PageLinkTable {
  type: string;
  from: number;
  to: number;
}
export type DbPageLink = Selectable<PageLinkTable>;
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
export type DbComponent = Selectable<ComponentTable>;
export type NewComponent = Insertable<ComponentTable>;
export type ComponentUpdate = Updateable<ComponentTable>;

export interface PageComponentTable {
  pageId: number;
  componentId: number;
}
export type DbPageComponent = Selectable<PageComponentTable>;
export type NewPageComponent = Insertable<PageComponentTable>;
export type PageComponentUpdate = Updateable<PageComponentTable>;

export interface ComponentRelationTable {
  parentId: number;
  childId: number;
}
export type DbComponentRelation = Selectable<ComponentRelationTable>;
export type NewComponentRelation = Insertable<ComponentRelationTable>;
export type ComponentRelationUpdate = Updateable<ComponentRelationTable>;
