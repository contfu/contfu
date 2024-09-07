import { Block } from "./blocks";

export type PageProps = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | Block
>;

export type PageData = {
  id: string;
  connection: string;
  path?: string;
  title?: string;
  description?: string;
  publishedAt: number;
  createdAt: number;
  updatedAt?: number;
  changedAt: number;
  collection: string;
  content: Block[];
  props: PageProps;
};

export type PageValidationError = {
  id: string;
  path: string;
  message: string;
};

export function isPageValidationError(
  data: PageData | PageValidationError
): data is PageValidationError {
  return "message" in data;
}

export function isPageData(
  data: PageData | PageValidationError
): data is PageData {
  return !isPageValidationError(data);
}
