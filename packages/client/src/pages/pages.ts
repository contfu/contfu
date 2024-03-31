import { OmitProperties } from "ts-essentials";

export type PageProps = {
  collection?: string;
  content?: object;
  attributes?: Record<string, any>;
  author?: object | string;
  linkType?: string;
};

export type Page<C extends PageProps = PageProps> = {
  slug: string;
  title: string;
  description?: string;
  connection: number;
  publishedAt: number;
  createdAt: number;
  updatedAt?: number;
  changedAt: number;
} & OmitProperties<
  {
    collection: C["collection"] extends string ? C["collection"] : never;
    content: C["content"] extends object ? C["content"] : never;
    attributes: C["attributes"] extends Record<string, any>
      ? C["attributes"]
      : never;
    author: C["author"] extends object ? C["author"] : never;
    links: Record<
      (C["linkType"] extends string ? C["linkType"] : never) | "content",
      PageLink[]
    >;
  },
  never
>;

export type PageLink = {
  slug: string;
  title: string;
  description?: string;
  attributes?: Record<string, any>;
};
