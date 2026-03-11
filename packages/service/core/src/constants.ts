/** Connection type identifiers.
 * 0–19: Custom types (client consumers, web crawl, etc.)
 * 20+:  Service integrations (Notion, Strapi, Contentful, …)
 */
export const ConnectionType = {
  // Custom types (0–19)
  CLIENT: 0,
  WEB: 1,
  // Service integrations (20+)
  NOTION: 20,
  STRAPI: 21,
  CONTENTFUL: 22,
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];

/** Metadata for each connection type. */
export const ConnectionTypeMeta: Record<
  ConnectionType,
  { label: string; editable: boolean; source: boolean; target: boolean }
> = {
  [ConnectionType.CLIENT]: { label: "client", editable: true, source: false, target: true },
  [ConnectionType.WEB]: { label: "web", editable: false, source: true, target: false },
  [ConnectionType.NOTION]: { label: "notion", editable: false, source: true, target: false },
  [ConnectionType.STRAPI]: { label: "strapi", editable: false, source: true, target: false },
  [ConnectionType.CONTENTFUL]: {
    label: "contentful",
    editable: false,
    source: true,
    target: false,
  },
};
