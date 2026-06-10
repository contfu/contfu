import { ConnectionType, defineEnum, type EnumValue } from "@contfu/core";
export { ConnectionType, SyncMode } from "@contfu/core";

/** Metadata for each connection type. */
export const ConnectionTypeMeta: Record<
  ConnectionType,
  { label: string; editable: boolean; source: boolean; target: boolean }
> = {
  [ConnectionType.APP]: {
    label: "Application Connection",
    editable: true,
    source: false,
    target: true,
  },
  [ConnectionType.WEB]: { label: "web", editable: false, source: true, target: false },
  [ConnectionType.NOTION]: { label: "notion", editable: false, source: true, target: false },
  [ConnectionType.STRAPI]: { label: "strapi", editable: false, source: true, target: false },
  [ConnectionType.CONTENTFUL]: {
    label: "contentful",
    editable: false,
    source: true,
    target: false,
  },
  [ConnectionType.WORDPRESS]: {
    label: "wordpress",
    editable: false,
    source: true,
    target: false,
  },
  [ConnectionType.SANITY]: {
    label: "sanity",
    editable: false,
    source: true,
    target: false,
  },
};

/** Authentication types for web connections. */
export const WebAuthType = defineEnum({
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
});

export type WebAuthType = EnumValue<typeof WebAuthType>;
