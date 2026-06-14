import { IntegrationType, defineEnum, type EnumValue } from "@contfu/core";
export { IntegrationType, SyncMode } from "@contfu/core";

/** Metadata for each integration type. */
export const IntegrationTypeMeta: Record<
  IntegrationType,
  { label: string; editable: boolean; source: boolean; target: boolean }
> = {
  [IntegrationType.APP]: {
    label: "Application Integration",
    editable: true,
    source: false,
    target: true,
  },
  [IntegrationType.WEB]: { label: "web", editable: false, source: true, target: false },
  [IntegrationType.NOTION]: { label: "notion", editable: false, source: true, target: false },
  [IntegrationType.STRAPI]: { label: "strapi", editable: false, source: true, target: false },
  [IntegrationType.CONTENTFUL]: {
    label: "contentful",
    editable: false,
    source: true,
    target: false,
  },
  [IntegrationType.WORDPRESS]: {
    label: "wordpress",
    editable: false,
    source: true,
    target: false,
  },
  [IntegrationType.SANITY]: {
    label: "sanity",
    editable: false,
    source: true,
    target: false,
  },
};

/** Authentication types for web integrations. */
export const WebAuthType = defineEnum({
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
});

export type WebAuthType = EnumValue<typeof WebAuthType>;
