import type { Insertable, Selectable, Updateable } from "kysely";

export interface Schema {
  page: PageTable;
  pageLink: PageLinkTable;
}

export interface PageTable {
  id: Uint8Array;
  path: string;
  collection: string | null;
  title: string;
  description: string | null;
  content: string | null;
  props: string | null;
  connection: Uint8Array;
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
  from: Uint8Array;
  to: Uint8Array;
}
export type DbPageLink = Selectable<PageLinkTable>;
export type NewPageLink = Insertable<PageLinkTable>;
export type PageLinkUpdate = Updateable<PageLinkTable>;
