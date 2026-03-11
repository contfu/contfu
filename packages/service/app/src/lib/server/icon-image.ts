import type { CollectionIcon } from "@contfu/core";

/** Block SSRF by rejecting non-public URLs before fetching. */
function isAllowedImageUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const h = url.hostname;
  // Block any IP address literal (IPv4 and IPv6) — only domain names allowed
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return false; // IPv4
  if (h.startsWith("[") || h === "::1") return false; // IPv6
  // Block localhost
  if (h === "localhost") return false;
  return true;
}

/**
 * If the icon is an image URL (not already a data URI), fetch it, resize to
 * 40×40 px and re-encode as AVIF, then return the result as a data URI.
 * Emoji icons and icons that are already data URIs are returned unchanged.
 * Returns null if the image cannot be fetched or converted — this prevents
 * expiring URLs (e.g. Notion S3 pre-signed URLs) from being persisted.
 */
export async function processIconForStorage(
  icon: CollectionIcon | null | undefined,
): Promise<CollectionIcon | null | undefined> {
  if (!icon || icon.type !== "image") return icon;
  if (icon.url.startsWith("data:")) return icon;
  if (!isAllowedImageUrl(icon.url)) return null;
  const { default: sharp } = await import("sharp");
  const response = await fetch(icon.url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  const avif = await sharp(buffer)
    .resize(40, 40, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .avif()
    .toBuffer();
  return { type: "image", url: `data:image/avif;base64,${avif.toString("base64")}` };
}
