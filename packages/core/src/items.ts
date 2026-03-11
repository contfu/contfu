import type { Block } from "./blocks";

export type PageProps = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | Block | Buffer[]
>;

export type Item<T extends PageProps = Record<never, never>> = {
  ref: Buffer;
  id: Buffer;
  collection: number;
  changedAt: number;
  props: T;
  content?: Block[];
};

/**
 * Connection type constants.
 * Identifies the kind of external service a connection links to.
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
