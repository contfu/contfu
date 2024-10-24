import { Block } from "./blocks";

export type PageProps = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | Block
>;

export type Item<T extends Record<string, any> = Record<never, never>> = {
  id: number;
  src: number;
  collection: number;
  publishedAt?: number;
  createdAt: number;
  changedAt: number;
  props: T;
};
