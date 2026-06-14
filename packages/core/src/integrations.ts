import { defineEnum, type EnumValue } from "./enums";

/**
 * Integration type constants.
 * Identifies the kind of external service an integration links to.
 */
export const IntegrationType = defineEnum({
  // Custom types (0–19)
  APP: 0,
  WEB: 1,
  // Service integrations (20+)
  NOTION: 20,
  STRAPI: 21,
  CONTENTFUL: 22,
  WORDPRESS: 23,
  SANITY: 24,
});

export type IntegrationType = EnumValue<typeof IntegrationType>;

/**
 * Shared sync trigger modes for source integrations.
 * Multiple modes can be enabled at once via bitwise OR.
 */
export const SyncMode = defineEnum({
  NONE: 0,
  POLL: 1,
  WEBHOOK: 2,
});

export type SyncMode = number; // bitmask: individual SyncMode values can be ORed together
