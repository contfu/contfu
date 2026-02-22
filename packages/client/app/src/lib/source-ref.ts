import { SourceType, type SourceType as SourceTypeValue } from "@contfu/core";

export type SourceRefLink = {
  type: SourceTypeValue | null;
  label: string;
  href: string | null;
};

export function parseSourceRef(sourceType: SourceTypeValue | null | undefined, ref: string | null | undefined): SourceRefLink {
  if (sourceType == null || !ref) {
    return {
      type: null,
      label: "Unknown",
      href: null,
    };
  }

  const label =
    sourceType === SourceType.NOTION
      ? "Notion"
      : sourceType === SourceType.STRAPI
        ? "Strapi"
        : "Web";

  return {
    type: sourceType,
    label,
    href: ref,
  };
}
