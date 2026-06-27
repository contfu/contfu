import {
  IntegrationRole,
  IntegrationType,
  defineEnum,
  integrationHasRole,
  type EnumValue,
} from "@contfu/core";
export { IntegrationType, SyncMode } from "@contfu/core";

type IntegrationTypeMetaEntry = {
  label: string;
  editable: boolean;
  source: boolean;
  target: boolean;
};

function integrationTypeMeta(
  label: string,
  type: IntegrationType,
  editable = false,
): IntegrationTypeMetaEntry {
  return {
    label,
    editable,
    source: integrationHasRole(type, IntegrationRole.SourceRole),
    target: integrationHasRole(type, IntegrationRole.TargetRole),
  };
}

/** Metadata for each integration type. */
export const IntegrationTypeMeta: Record<IntegrationType, IntegrationTypeMetaEntry> = {
  [IntegrationType.APP]: integrationTypeMeta("Application Integration", IntegrationType.APP, true),
  [IntegrationType.WEB]: integrationTypeMeta("web", IntegrationType.WEB),
  [IntegrationType.WEBHOOK]: integrationTypeMeta("webhook", IntegrationType.WEBHOOK, true),
  [IntegrationType.NOTION]: integrationTypeMeta("notion", IntegrationType.NOTION),
  [IntegrationType.STRAPI]: integrationTypeMeta("strapi", IntegrationType.STRAPI),
  [IntegrationType.CONTENTFUL]: integrationTypeMeta("contentful", IntegrationType.CONTENTFUL),
  [IntegrationType.WORDPRESS]: integrationTypeMeta("wordpress", IntegrationType.WORDPRESS),
  [IntegrationType.SANITY]: integrationTypeMeta("sanity", IntegrationType.SANITY),
  [IntegrationType.STORYBLOK]: integrationTypeMeta("storyblok", IntegrationType.STORYBLOK),
  [IntegrationType.DIRECTUS]: integrationTypeMeta("directus", IntegrationType.DIRECTUS),
  [IntegrationType.PRISMIC]: integrationTypeMeta("prismic", IntegrationType.PRISMIC),
};

/** Authentication types for web integrations. */
export const WebAuthType = defineEnum({
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
});

export type WebAuthType = EnumValue<typeof WebAuthType>;
