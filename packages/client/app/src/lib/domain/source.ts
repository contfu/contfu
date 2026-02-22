import { SourceType } from "@contfu/core";

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  [SourceType.NOTION]: "Notion",
  [SourceType.STRAPI]: "Strapi",
  [SourceType.WEB]: "Web",
};
