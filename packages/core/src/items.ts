import { Block } from "./blocks";

export type PageProps = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | Block | Buffer[]
>;

export type Item<T extends PageProps = Record<never, never>> = {
  id: Buffer;
  collection: number;
  publishedAt?: number;
  createdAt: number;
  changedAt: number;
  props: T;
  content?: Block[];
};

/**
 * The size of an item id in bytes.
 * The longer the id, the more collision resistant the id is, but the more
 * storage it takes.
 * | Samples    | 8 bytes        | 12 bytes      | 16 bytes      |
 * |------------|----------------|---------------|---------------|
 * | 1,000      | P ≈ 2.71e-9%   | P ≈ 2.71e-21% | P ≈ 2.71e-33% |
 * | 10,000     | P ≈ 2.71e-7%   | P ≈ 2.71e-19% | P ≈ 2.71e-31% |
 * | 100,000    | P ≈ 0.0000271% | P ≈ 2.71e-17% | P ≈ 2.71e-29% |
 * | 1,000,000  | P ≈ 0.00271%   | P ≈ 2.71e-15% | P ≈ 2.71e-27% |
 * | 10,000,000 | P ≈ 0.271%     | P ≈ 2.71e-13% | P ≈ 2.71e-25% |

Notes:
- P = Probability of at least one collision (percentage)
- E = Expected number of collisions (absolute number)
- Scientific notation used for very small numbers
- 100% probability means collisions are virtually guaranteed
- Values are rounded for readability
 */
export const ITEM_ID_SIZE = Number(process.env.ITEM_ID_SIZE ?? 8);
