import { Block, PageData, PageProps } from "@contfu/core";
import { MarkRequired, OmitProperties } from "ts-essentials";

export type PageOpts = {
  content?: object;
  props?: PageProps;
  author?: object | string;
  linkType?: string;
};

export type Page<C extends PageOpts = PageOpts> = MarkRequired<
  Omit<PageData, "content" | "props">,
  "path" | "title"
> &
  OmitProperties<
    {
      content: C["content"] extends object ? C["content"] : Block[];
      props: C["props"] extends PageProps ? C["props"] : never;
      author: C["author"] extends object | string ? C["author"] : never;
      links: Record<
        (C["linkType"] extends string ? C["linkType"] : never) | "content",
        PageLink[]
      >;
    },
    never
  >;

export type PageLink = {
  path: string;
  title: string;
  description?: string;
  props?: Record<string, any>;
};
