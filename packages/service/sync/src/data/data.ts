import { Block } from "@contfu/core";

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
