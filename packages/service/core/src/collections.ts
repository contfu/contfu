import type { Collection } from "@contfu/core";

export interface ServiceCollection extends Collection {
  influxCount: number;
  connectionCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}
