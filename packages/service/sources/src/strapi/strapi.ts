/** Options for fetching entries from a Strapi collection. */
export type StrapiFetchOpts = {
  collection: number;
  /** Content type UID (e.g., "api::article.article") */
  ref: Buffer;
  /** Base URL of the Strapi instance (required, unlike Notion). */
  url: string;
  /** API token for authentication. */
  credentials: Buffer;
  /** Fetch entries modified since this timestamp (exclusive). */
  since?: number;
};

/** Strapi REST API pagination response metadata. */
export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

/** Strapi REST API response wrapper. */
export interface StrapiResponse<T> {
  data: T;
  meta: {
    pagination: StrapiPagination;
  };
}

/** Strapi entry attributes. */
export type StrapiAttributes = Record<string, StrapiFieldValue>;

/** Strapi entry structure (v4 format). */
export interface StrapiEntry {
  id: number;
  documentId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  [key: string]: StrapiFieldValue | number | string | undefined;
}

/** Strapi relation data structure. */
export interface StrapiRelationData {
  id: number;
  documentId: string;
}

/** Strapi media/file structure. */
export interface StrapiMedia {
  id: number;
  documentId: string;
  name: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number;
  height?: number;
  formats?: Record<string, StrapiMediaFormat>;
  url: string;
  mime: string;
}

/** Strapi media format variant. */
export interface StrapiMediaFormat {
  name: string;
  width: number;
  height: number;
  url: string;
}

/** Strapi component structure. */
export interface StrapiComponent {
  id: number;
  __component: string;
  [key: string]: StrapiFieldValue | number | string;
}

/** Strapi blocks (rich text) structure. */
export interface StrapiBlock {
  type: string;
  children?: StrapiBlockChild[];
  level?: number;
  format?: string;
  image?: StrapiMedia;
  url?: string;
  [key: string]: unknown;
}

/** Strapi block child node. */
export interface StrapiBlockChild {
  type: string;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  url?: string;
  children?: StrapiBlockChild[];
}

/** All possible Strapi field value types. */
export type StrapiFieldValue =
  | string
  | number
  | boolean
  | null
  | StrapiMedia
  | StrapiMedia[]
  | StrapiRelationData
  | StrapiRelationData[]
  | StrapiComponent
  | StrapiComponent[]
  | StrapiBlock[]
  | StrapiFieldValue[];

/** Strapi content type schema attribute. */
export interface StrapiSchemaAttribute {
  type: string;
  required?: boolean;
  relation?: string;
  target?: string;
  multiple?: boolean;
  component?: string;
  repeatable?: boolean;
  allowedTypes?: string[];
  enum?: string[];
}

/** Strapi content type schema. */
export interface StrapiContentTypeSchema {
  uid: string;
  apiID: string;
  kind: string;
  info: {
    displayName: string;
    singularName: string;
    pluralName: string;
    description?: string;
  };
  attributes: Record<string, StrapiSchemaAttribute>;
}
