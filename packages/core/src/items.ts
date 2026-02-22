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
 * Source type constants
 */
export const SourceType = {
  NOTION: 0,
  STRAPI: 1,
  WEB: 2,
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];
