import { SourceType } from "@contfu/svc-core";
import { buildApiUrl } from "../strapi/strapi-helpers";
import { uuidToBuffer } from "./ids";

export const STRAPI_REF_MODE_FULL_URL = 0;
export const STRAPI_REF_MODE_CLOUD_SHORT = 1;

export function encodeNotionRef(pageId: string): Buffer {
  return Buffer.concat([Buffer.from([SourceType.NOTION]), uuidToBuffer(pageId)]);
}

export function encodeWebRef(url: string): Buffer {
  return Buffer.concat([Buffer.from([SourceType.WEB]), Buffer.from(url, "utf8")]);
}

export function encodeStrapiRef(opts: {
  baseUrl: string;
  contentTypeUid: Buffer;
  documentId: string;
}): Buffer {
  if (isStrapiCloud(opts.baseUrl)) {
    const cloudData = Buffer.from(
      `${opts.contentTypeUid.toString("utf8")}\0${opts.documentId}`,
      "utf8",
    );
    return Buffer.concat([
      Buffer.from([SourceType.STRAPI, STRAPI_REF_MODE_CLOUD_SHORT]),
      cloudData,
    ]);
  }

  const itemUrl = `${buildApiUrl(opts.baseUrl, opts.contentTypeUid)}/${opts.documentId}`;
  return Buffer.concat([
    Buffer.from([SourceType.STRAPI, STRAPI_REF_MODE_FULL_URL]),
    Buffer.from(itemUrl, "utf8"),
  ]);
}

function isStrapiCloud(baseUrl: string): boolean {
  let host = "";
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host.endsWith("strapiapp.com") || host.includes("cloud.strapi");
}
