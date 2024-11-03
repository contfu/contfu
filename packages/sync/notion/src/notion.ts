export type NotionFetchOpts = {
  collection: number;
  ref: Buffer;
  credentials: Buffer;
  since?: number;
};
