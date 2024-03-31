import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Schema {
  connection: ConnectionTable;
  page: PageTable;
  pageLink: PageLinkTable;
}

export interface ConnectionTable {
  id: Generated<number>;
  name: string;
  key: string | null;
  target: string | null;
  type: string;
}
export type DbConnection = Selectable<ConnectionTable>;
export type NewConnection = Insertable<ConnectionTable>;
export type ConnectionUpdate = Updateable<ConnectionTable>;

export interface PageTable {
  id: Generated<number>;
  ref: string;
  slug: string;
  collection: string | null;
  title: string;
  description: string | null;
  content: string | null;
  attributes: string | null;
  connection: number;
  createdAt: number;
  changedAt: number;
  updatedAt: number | null;
  publishedAt: number;
  author: string | null;
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
