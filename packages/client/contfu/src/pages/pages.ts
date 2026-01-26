import type { Block } from "@contfu/core";

export interface Page<T extends { collection?: string } = { collection: string }> {
  collection: T extends { collection: infer C } ? C : string;
}

export interface PageData<P extends Page = Page> {
  id: string;
  ref: string;
  connection: string;
  path: string;
  collection: P["collection"];
  title: string;
  description: string;
  content: Block[];
  props: Record<string, unknown>;
  author?: unknown;
  publishedAt: number;
  createdAt: number;
  changedAt: number;
  updatedAt?: number;
  links: Record<string, string[]> & { content: string[] };
}
