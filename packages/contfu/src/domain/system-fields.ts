export const SYSTEM_FIELD_NAMES = [
  "$id",
  "$ref",
  "$collection",
  "$changedAt",
  "$connectionType",
] as const;

export type SystemFieldName = (typeof SYSTEM_FIELD_NAMES)[number];

export const SYSTEM_FIELD_SET = new Set<string>(SYSTEM_FIELD_NAMES);
