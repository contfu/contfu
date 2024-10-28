import { MarkRequired } from "ts-essentials";
import { CollectionFetchOpts } from "../source";

export type NotionPullOpts = MarkRequired<
  CollectionFetchOpts,
  "ref" | "credentials"
>;
