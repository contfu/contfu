import { SourceType, type SourceType as SourceTypeValue } from "@contfu/core";

export function notionRefUrlFromRawUuid(rawUuid: Buffer): string {
  if (rawUuid.length !== 16) {
    throw new Error(`Invalid Notion ref length: ${rawUuid.length}`);
  }
  return `https://notion.so/${rawUuid.toString("hex")}`;
}

export function strapiRefUrl(
  rawDocumentId: Buffer,
  sourceUrl: string,
  contentTypeUid: Buffer,
): string {
  const documentId = rawDocumentId.toString("utf8").trim();
  const uid = contentTypeUid.toString("utf8").trim();
  const origin = sourceUrl.replace(/\/$/, "");
  const parts = uid.split(".");
  const singular = parts[parts.length - 1] ?? uid;
  const collection = `${singular}s`;
  return `${origin}/api/${collection}/${documentId}`;
}

export function webRefUrl(rawUrl: Buffer): string {
  return rawUrl.toString("utf8").trim();
}

export function getItemRefForSource(opts: {
  sourceType: number;
  rawRef: Buffer;
  sourceUrl?: string | null;
  collectionRef?: Buffer | null;
}): { sourceType: SourceTypeValue; ref: string } {
  if (opts.sourceType === SourceType.NOTION) {
    return { sourceType: SourceType.NOTION, ref: notionRefUrlFromRawUuid(opts.rawRef) };
  }
  if (opts.sourceType === SourceType.STRAPI) {
    if (!opts.sourceUrl) throw new Error("Missing sourceUrl for Strapi ref encoding");
    if (!opts.collectionRef) throw new Error("Missing collectionRef for Strapi ref encoding");
    return {
      sourceType: SourceType.STRAPI,
      ref: strapiRefUrl(opts.rawRef, opts.sourceUrl, opts.collectionRef),
    };
  }
  if (opts.sourceType === SourceType.WEB) {
    return { sourceType: SourceType.WEB, ref: webRefUrl(opts.rawRef) };
  }
  throw new Error(`Unsupported source type: ${opts.sourceType}`);
}
