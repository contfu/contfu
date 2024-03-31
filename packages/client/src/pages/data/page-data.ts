import { Page, PageProps } from "../pages";

export type PageData = Omit<Page, "links"> & {
  id: number;
  ref?: string;
} & Omit<PageProps, "linkType"> & { links: Record<string, string[]> };

export type PageMeta = Omit<PageData, "id" | "content">;
