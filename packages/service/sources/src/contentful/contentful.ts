/** Options for fetching entries from a Contentful space. */
export type ContentfulFetchOpts = {
  collection: number;
  /** Content type ID (e.g., "blogPost") */
  ref: Buffer;
  /** Contentful space ID. */
  spaceId: string;
  /** Contentful environment ID (default: "master") */
  environmentId?: string;
  /** Contentful API access token. */
  credentials: Buffer;
  /** Fetch entries modified since this timestamp (exclusive). */
  since?: number;
};

/** Contentful REST API response wrapper. */
export interface ContentfulResponse<T> {
  sys: {
    type: string;
    total: number;
    limit: number;
    skip: number;
  };
  items: T[];
  includes?: {
    Asset?: ContentfulAsset[];
    Entry?: ContentfulEntry[];
  };
}

/** Contentful entry sys metadata. */
export interface ContentfulSys {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  contentType?: {
    sys: {
      id: string;
    };
  };
}

/** Contentful entry field values. */
export type ContentfulFields = Record<string, ContentfulFieldValue>;

/** Contentful entry structure. */
export interface ContentfulEntry {
  sys: ContentfulSys;
  fields: ContentfulFields;
}

/** Contentful asset sys metadata. */
export interface ContentfulAssetSys {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  contentType: string;
  filename?: string;
}

/** Contentful asset fields. */
export interface ContentfulAssetFields {
  title?: { "en-US": string };
  description?: { "en-US": string };
  file?: {
    "en-US": {
      url: string;
      details?: {
        image?: { width: number; height: number };
        file?: { size: number };
      };
      fileName?: string;
      contentType?: string;
    };
  };
}

/** Contentful asset structure. */
export interface ContentfulAsset {
  sys: ContentfulAssetSys;
  fields: ContentfulAssetFields;
}

/** Contentful rich text document. */
export interface ContentfulRichText {
  nodeType: "document";
  data: Record<string, unknown>;
  content: ContentfulRichTextNode[];
}

/** Contentful rich text node. */
export interface ContentfulRichTextNode {
  nodeType: string;
  value?: string;
  marks?: Array<{ type: string }>;
  data?: Record<string, unknown>;
  content?: ContentfulRichTextNode[];
  dataUri?: string;
  contentType?: string;
  fileName?: string;
}

/** All possible Contentful field value types. */
export type ContentfulFieldValue =
  | string
  | number
  | boolean
  | null
  | ContentfulLink<ContentfulAsset>
  | ContentfulLink<ContentfulAsset>[]
  | ContentfulLink<ContentfulEntry>
  | ContentfulLink<ContentfulEntry>[]
  | ContentfulRichText
  | ContentfulLocation
  | { "en-US": ContentfulFieldValue }
  | ContentfulFieldValue[];

/** Contentful link to another entry or asset. */
export interface ContentfulLink<T> {
  sys: {
    type: "Link";
    linkType: string;
    id: string;
  };
}

/** Contentful location (geopoint). */
export interface ContentfulLocation {
  lat: number;
  lon: number;
}

/** Contentful content type field. */
export interface ContentfulContentTypeField {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  validations?: Array<Record<string, unknown>>;
  disabled?: boolean;
  omitted?: boolean;
}

/** Contentful content type schema. */
export interface ContentfulContentType {
  sys: {
    id: string;
    type: string;
    createdAt: string;
    updatedAt: string;
  };
  name: string;
  description?: string;
  displayField?: string;
  fields: ContentfulContentTypeField[];
}
