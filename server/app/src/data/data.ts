import { Block, Item } from "@contfu/core";

export enum SourceType {
  NOTION = 1,
}

export type ServerPageProps = Record<
  string,
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | Block
  | Buffer // Many-to-one relation
  | Buffer[] // Many-to-many relation
>;

export type SyncItem = Item<any> & {
  ref: Buffer;
};
