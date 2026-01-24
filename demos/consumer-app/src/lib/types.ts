/**
 * Type definitions for the demo consumer app.
 */

import type { Block } from "@contfu/core";

export interface Article {
  id: string;
  title: string;
  slug: string;
  description: string;
  createdAt: Date;
  changedAt: Date;
  content: Block[];
}
