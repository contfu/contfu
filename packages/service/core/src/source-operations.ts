import { defineEnum, type EnumValue } from "@contfu/core";

/** User-facing source operation kinds returned by the service API. */
export const SourceOperationType = defineEnum({
  SYNC_NOW: 1,
  FULL_REFRESH: 2,
});
export type SourceOperationType = EnumValue<typeof SourceOperationType>;

/** Durable lifecycle statuses for source operations. */
export const SourceOperationStatus = defineEnum({
  PENDING: 0,
  RUNNING: 1,
  COMPLETED: 2,
  FAILED: 3,
  BLOCKED: 4,
});
export type SourceOperationStatus = EnumValue<typeof SourceOperationStatus>;
