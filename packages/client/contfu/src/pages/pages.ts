import type { Block } from "@contfu/core";

export interface PageData {
  id: string;
  ref: string;
  collection: string;
  props: Record<string, unknown>;
  changedAt: number;
  content?: Block[];
  links: Record<string, string[]> & { content: string[] };
}
