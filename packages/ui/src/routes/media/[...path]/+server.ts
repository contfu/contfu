import { error } from "@sveltejs/kit";
import { mediaStore } from "$lib/server/media";
import { convertMedia, getAsset, type MediaConvertOpts, type MediaTransform } from "@contfu/contfu";
import { mimeTypes } from "@contfu/core";
import type { RequestHandler } from "./$types";

let transform: MediaTransform | null = null;

async function getTransform(): Promise<MediaTransform> {
  if (transform) return transform;
  const { createTransform } = await import("@contfu/media-optimizer");
  transform = createTransform();
  return transform;
}

/**
 * Parse path like "abc123def.avif" into { id: "abc123def", ext: "avif" }
 */
function parsePath(filePath: string): { id: string; ext: string } | null {
  const dotIdx = filePath.lastIndexOf(".");
  if (dotIdx === -1) return null;
  return { id: filePath.slice(0, dotIdx), ext: filePath.slice(dotIdx + 1).toLowerCase() };
}

/** Read a query param with shorthand fallback */
function param(url: URL, short: string, long: string): string | null {
  return url.searchParams.get(short) ?? url.searchParams.get(long);
}

function intParam(url: URL, short: string, long: string): number | undefined {
  const v = param(url, short, long);
  return v ? parseInt(v, 10) : undefined;
}

function strParam(url: URL, short: string, long: string): string | undefined {
  return param(url, short, long) ?? undefined;
}

/** Detect media type from mime type prefix */
function mediaTypeFromExt(ext: string): "image" | "video" | "audio" {
  const mime = mimeTypes[ext];
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  return "image";
}

/** Build conversion opts from query params, scoped to the media type */
function buildOpts(url: URL, mediaType: "image" | "video" | "audio"): MediaConvertOpts | null {
  if (mediaType === "image") {
    const width = intParam(url, "w", "width");
    const height = intParam(url, "h", "height");
    const quality = intParam(url, "q", "quality");
    const fit = strParam(url, "f", "fit");
    const rotate = intParam(url, "r", "rotate");
    const cropLeft = intParam(url, "cl", "cropLeft");
    const cropTop = intParam(url, "ct", "cropTop");
    const cropWidth = intParam(url, "cw", "cropWidth");
    const cropHeight = intParam(url, "ch", "cropHeight");

    if (!(width || height || quality || fit || rotate || cropWidth)) return null;

    return {
      mediaType,
      width,
      height,
      quality,
      fit,
      rotate,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
    };
  }

  if (mediaType === "video") {
    const width = intParam(url, "w", "width");
    const height = intParam(url, "h", "height");
    const fps = intParam(url, "fps", "fps");
    const videoCodec = strParam(url, "vc", "videoCodec");
    const videoBitrate = strParam(url, "vb", "videoBitrate");
    const audioCodec = strParam(url, "ac", "audioCodec");
    const audioBitrate = strParam(url, "ab", "audioBitrate");
    const size = strParam(url, "s", "size");

    if (
      !(width || height || fps || videoCodec || videoBitrate || audioCodec || audioBitrate || size)
    )
      return null;

    return {
      mediaType,
      width,
      height,
      fps,
      videoCodec,
      videoBitrate,
      audioCodec,
      audioBitrate,
      size,
    };
  }

  // audio
  const codec = strParam(url, "c", "codec");
  const bitrate = strParam(url, "b", "bitrate");

  if (!(codec || bitrate)) return null;

  return { mediaType, codec, bitrate };
}

export const GET: RequestHandler = async ({ params, url }) => {
  const filePath = params.path;
  const parsed = parsePath(filePath);

  if (!parsed) {
    // Extensionless: treat as asset ID, look up ext from DB
    const asset = getAsset(filePath);
    if (!asset) error(404, "Not found");
    const data = await mediaStore.read(`${asset.id}.${asset.ext}`);
    if (!data) error(404, "Not found");
    const contentType = mimeTypes[asset.ext] ?? "application/octet-stream";
    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const { id, ext } = parsed;

  const mediaType = mediaTypeFromExt(ext);
  const opts = buildOpts(url, mediaType);

  if (opts) {
    const t = await getTransform();
    const data = await convertMedia(id, ext, opts, t);
    if (!data) error(404, "Not found");

    const contentType = mimeTypes[ext] ?? "application/octet-stream";

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const data = await mediaStore.read(filePath);
  if (!data) error(404, "Not found");

  const contentType = mimeTypes[ext] ?? "application/octet-stream";

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
