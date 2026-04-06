/**
 * Connection type constants.
 * Identifies the kind of external service a connection links to.
 */
export const ConnectionType = {
  // Custom types (0–19)
  APP: 0,
  WEB: 1,
  // Service integrations (20+)
  NOTION: 20,
  STRAPI: 21,
  CONTENTFUL: 22,
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];
