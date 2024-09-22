import { Block } from "./blocks";

export type PageProps = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | Block
>;

export type Item<T extends Record<string, any> = Record<never, never>> = {
  id: string;
  src: number;
  collection: number;
  publishedAt?: number;
  createdAt: number;
  changedAt: number;
  props: T;
};

export type PageValidationError = {
  id: string;
  path: string;
  message: string;
};

export function isPageValidationError(
  data: Item | PageValidationError
): data is PageValidationError {
  return "message" in data;
}

export function isPageData(data: Item | PageValidationError): data is Item {
  return !isPageValidationError(data);
}
