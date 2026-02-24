import type { Collection } from "@contfu/core";

export interface ServiceCollection extends Collection {
  displayName: string;
  influxCount: number;
  connectionCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}
