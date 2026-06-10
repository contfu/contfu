import type { Block } from "./blocks";

export type PageProps = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | Block | Block[] | Buffer[] | any
>;

export type Item<T extends PageProps = Record<never, never>> = {
  ref: Buffer;
  id: Buffer;
  collection: number;
  changedAt: number;
  props: T;
  content?: Block[];
};
