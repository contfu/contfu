import { ConnectionType } from "@contfu/core";

export type SourceRefLink = {
  type: ConnectionType | null;
  label: string;
  href: string | null;
};

export function parseSourceRef(
  connectionType: ConnectionType | null | undefined,
  ref: string | null | undefined,
): SourceRefLink {
  if (connectionType == null || !ref) {
    return {
      type: null,
      label: "Unknown",
      href: null,
    };
  }

  const label =
    connectionType === ConnectionType.NOTION
      ? "Notion"
      : connectionType === ConnectionType.STRAPI
        ? "Strapi"
        : "Web";

  return {
    type: connectionType,
    label,
    href: ref,
  };
}
