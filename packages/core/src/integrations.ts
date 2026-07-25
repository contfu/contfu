import { defineEnum, type EnumValue } from "./enums";

/**
 * Integration type constants.
 * Identifies the kind of external service an integration links to.
 */
export const IntegrationType = defineEnum({
  // Custom types (0–19)
  APP: 0,
  WEB: 1,
  WEBHOOK: 2,
  // Service integrations (20+)
  NOTION: 20,
  STRAPI: 21,
  CONTENTFUL: 22,
  WORDPRESS: 23,
  SANITY: 24,
  STORYBLOK: 25,
  DIRECTUS: 26,
  PRISMIC: 27,
});

export type IntegrationType = EnumValue<typeof IntegrationType>;

export const IntegrationRole = defineEnum({
  SourceRole: 1,
  TargetRole: 2,
});

export type IntegrationRole = EnumValue<typeof IntegrationRole>;

export const IntegrationCapability = defineEnum({
  ComponentDiscovery: 1,
  ComponentContract: 2,
  ManualLocalizationLayer: 3,
  ContentProvide: 4,
  ContentReceive: 5,
  FileReceive: 6,
  TargetDeliveryCapability: 7,
  TargetSchemaDelivery: 8,
  CollectionDiscovery: 9,
});

export type IntegrationCapability = EnumValue<typeof IntegrationCapability>;

export const IntegrationRoles = {
  [IntegrationType.APP]: [IntegrationRole.TargetRole],
  [IntegrationType.WEB]: [IntegrationRole.SourceRole],
  [IntegrationType.WEBHOOK]: [IntegrationRole.TargetRole],
  [IntegrationType.NOTION]: [IntegrationRole.SourceRole, IntegrationRole.TargetRole],
  [IntegrationType.STRAPI]: [IntegrationRole.SourceRole, IntegrationRole.TargetRole],
  [IntegrationType.CONTENTFUL]: [IntegrationRole.SourceRole],
  [IntegrationType.WORDPRESS]: [IntegrationRole.SourceRole],
  [IntegrationType.SANITY]: [IntegrationRole.SourceRole],
  [IntegrationType.STORYBLOK]: [IntegrationRole.SourceRole],
  [IntegrationType.DIRECTUS]: [IntegrationRole.SourceRole],
  [IntegrationType.PRISMIC]: [IntegrationRole.SourceRole],
} as const satisfies Record<IntegrationType, readonly IntegrationRole[]>;

export const IntegrationCapabilities = {
  [IntegrationType.APP]: [
    IntegrationCapability.ComponentContract,
    IntegrationCapability.ManualLocalizationLayer,
    IntegrationCapability.ContentReceive,
    IntegrationCapability.TargetDeliveryCapability,
    IntegrationCapability.TargetSchemaDelivery,
  ],
  [IntegrationType.WEB]: [
    IntegrationCapability.ManualLocalizationLayer,
    IntegrationCapability.ContentProvide,
  ],
  [IntegrationType.WEBHOOK]: [
    IntegrationCapability.ContentReceive,
    IntegrationCapability.TargetDeliveryCapability,
  ],
  [IntegrationType.NOTION]: [
    IntegrationCapability.CollectionDiscovery,
    IntegrationCapability.ManualLocalizationLayer,
    IntegrationCapability.ContentProvide,
    IntegrationCapability.ContentReceive,
    IntegrationCapability.TargetDeliveryCapability,
  ],
  [IntegrationType.STRAPI]: [
    IntegrationCapability.CollectionDiscovery,
    IntegrationCapability.ComponentDiscovery,
    IntegrationCapability.ManualLocalizationLayer,
    IntegrationCapability.ContentProvide,
    IntegrationCapability.ContentReceive,
    IntegrationCapability.TargetDeliveryCapability,
  ],
  [IntegrationType.CONTENTFUL]: [
    IntegrationCapability.CollectionDiscovery,
    IntegrationCapability.ComponentDiscovery,
    IntegrationCapability.ManualLocalizationLayer,
    IntegrationCapability.ContentProvide,
  ],
  [IntegrationType.WORDPRESS]: [
    IntegrationCapability.CollectionDiscovery,
    IntegrationCapability.ManualLocalizationLayer,
    IntegrationCapability.ContentProvide,
  ],
  [IntegrationType.SANITY]: [
    IntegrationCapability.CollectionDiscovery,
    IntegrationCapability.ComponentDiscovery,
    IntegrationCapability.ManualLocalizationLayer,
    IntegrationCapability.ContentProvide,
  ],
  [IntegrationType.STORYBLOK]: [IntegrationCapability.ContentProvide],
  [IntegrationType.DIRECTUS]: [
    IntegrationCapability.CollectionDiscovery,
    IntegrationCapability.ContentProvide,
  ],
  [IntegrationType.PRISMIC]: [IntegrationCapability.ContentProvide],
} as const satisfies Record<IntegrationType, readonly IntegrationCapability[]>;

export function integrationHasCapability(
  type: IntegrationType | null | undefined,
  capability: IntegrationCapability,
): boolean {
  return (
    type != null &&
    (IntegrationCapabilities[type] as readonly IntegrationCapability[] | undefined)?.includes(
      capability,
    ) === true
  );
}

export function integrationHasRole(
  type: IntegrationType | null | undefined,
  role: IntegrationRole,
): boolean {
  return (
    type != null &&
    (IntegrationRoles[type] as readonly IntegrationRole[] | undefined)?.includes(role) === true
  );
}

export function integrationSupportsContentProvide(type: IntegrationType | null | undefined) {
  return integrationHasCapability(type, IntegrationCapability.ContentProvide);
}

export function integrationSupportsContentReceive(type: IntegrationType | null | undefined) {
  return integrationHasCapability(type, IntegrationCapability.ContentReceive);
}

export function integrationSupportsTargetSchemaDelivery(type: IntegrationType | null | undefined) {
  return integrationHasCapability(type, IntegrationCapability.TargetSchemaDelivery);
}

/** Target schema delivery semantics. */
export const TargetSchemaDeliveryMode = defineEnum({
  /** Notify the target about schema/lifecycle changes without mutating remote schemas. */
  NOTIFICATION_ONLY: 1,
  /** Mutate the target's remote schema. Unsupported for v1 unless explicitly enabled later. */
  MUTATING: 2,
});

export type TargetSchemaDeliveryMode = EnumValue<typeof TargetSchemaDeliveryMode>;

export function integrationTargetSchemaDeliveryMode(
  type: IntegrationType | null | undefined,
): TargetSchemaDeliveryMode | null {
  if (!integrationSupportsTargetSchemaDelivery(type)) return null;
  if (type === IntegrationType.APP) return TargetSchemaDeliveryMode.MUTATING;
  return TargetSchemaDeliveryMode.NOTIFICATION_ONLY;
}

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
