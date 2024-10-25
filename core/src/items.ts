import { Block } from "./blocks";

export type PageProps = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | Block
>;

export type Item<T extends PageProps = Record<never, never>> = {
  id: number;
  collection: number;
  publishedAt?: number;
  createdAt: number;
  changedAt: number;
  props: T;
};
