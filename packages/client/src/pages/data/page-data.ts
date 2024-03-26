import { Page, PageProps } from "../pages";

export type PageData = Page & { id: number; ref?: string } & PageProps;
