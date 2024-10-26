import { Block } from "./blocks";

export type PageProps = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | Block | Buffer[]
>;

export type Item<T extends PageProps = Record<never, never>> = {
  id: Buffer;
  collection: number;
  publishedAt?: number;
  createdAt: number;
  changedAt: number;
  props: T;
};
