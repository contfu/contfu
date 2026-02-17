import type { Block } from "@contfu/core";

export interface ItemData {
  id: string;
  ref: string;
  collection: string;
  props: Record<string, unknown>;
  changedAt: number;
  content?: Block[];
  links: Record<string, string[]> & { content: string[] };
}

/** @deprecated Use ItemData instead. */
export type PageData = ItemData;
