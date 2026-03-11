import { ConnectionType } from "@contfu/core";

export const SOURCE_TYPE_LABELS: Record<ConnectionType, string> = {
  [ConnectionType.NOTION]: "Notion",
  [ConnectionType.STRAPI]: "Strapi",
  [ConnectionType.WEB]: "Web",
  [ConnectionType.CONTENTFUL]: "Contentful",
  [ConnectionType.CLIENT]: "Client",
};
