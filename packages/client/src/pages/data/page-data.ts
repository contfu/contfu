import { Page, PageProps } from "../pages";

export type PageData<P extends Page = Page> = Omit<P, "links"> & {
  id: number;
  ref: string;
} & Omit<PageProps, "linkType"> & {
    links: { [k in keyof P["links"]]: string[] };
  };
