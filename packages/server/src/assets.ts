import { mimeTypes } from "@contfu/core";
import type { AssetStore, MediaConvertOpts, MediaOptimizer } from "@contfu/contfu";
import {
  AssetLoadError,
  assetStore as defaultAssetStore,
  getAsset,
  loadAsset,
} from "@contfu/contfu";

type RouteRequest = Request & { params: Record<string, string> };

export type ServerAssetOptions = {
  assetStore?: AssetStore;
  mediaOptimizer?: MediaOptimizer;
  cache?: boolean;
  importModule?: (name: string) => Promise<unknown>;
};

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Read a query param with shorthand fallback */
function param(url: URL, short: string, long: string): string | null {
  return url.searchParams.get(short) ?? url.searchParams.get(long);
}

function intParam(url: URL, short: string, long: string): number | undefined {
  const value = param(url, short, long);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function strParam(url: URL, short: string, long: string): string | undefined {
  return param(url, short, long) ?? undefined;
}

function parseAssetPath(filePath: string): { id: string; ext: string } | null {
  const dotIdx = filePath.lastIndexOf(".");
  if (dotIdx === -1) return null;
  return { id: filePath.slice(0, dotIdx), ext: filePath.slice(dotIdx + 1).toLowerCase() };
}

function mediaTypeFromExt(ext: string): "image" | "video" | "audio" | null {
  const mime = mimeTypes[ext];
  if (!mime) return null;
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  return null;
}

export function buildAssetOpts(
  url: URL,
  mediaType: "image" | "video" | "audio" | null,
): MediaConvertOpts | null {
  if (mediaType === null) return null;
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
      fit: fit as MediaConvertOpts["fit"],
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
    ) {
      return null;
    }

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

  const codec = strParam(url, "c", "codec");
  const bitrate = strParam(url, "b", "bitrate");

  if (!(codec || bitrate)) return null;

  return { mediaType, codec, bitrate };
}

export async function getAssetStore({
  assetStore,
  importModule = (name) => import(name),
}: Pick<ServerAssetOptions, "assetStore" | "importModule"> = {}): Promise<AssetStore> {
  if (assetStore) {
    return assetStore;
  }

  if (!process.env.ASSET_URL) {
    return defaultAssetStore;
  }

  try {
    const fileStore = (await importModule("@contfu/bun-file-store")) as {
      FileStore: new (url: string) => AssetStore;
    };
    return new fileStore.FileStore(process.env.ASSET_URL);
  } catch (error) {
    throw new Error(
      `Failed to load @contfu/bun-file-store. Install the optional dependency to use ASSET_URL. ${String(error)}`,
    );
  }
}

export async function getMediaOptimizer({
  mediaOptimizer,
  importModule = (name) => import(name),
}: Pick<ServerAssetOptions, "mediaOptimizer" | "importModule"> = {}): Promise<MediaOptimizer> {
  if (mediaOptimizer) {
    return mediaOptimizer;
  }

  if (process.env.M4K_URL) {
    try {
      const remote = (await importModule("@contfu/media-optimizer-remote")) as {
        M4kRemoteOptimizer: new (url: string) => MediaOptimizer;
      };
      return new remote.M4kRemoteOptimizer(process.env.M4K_URL);
    } catch (error) {
      throw new Error(
        `Failed to load @contfu/media-optimizer-remote. Install the optional dependency to use M4K_URL. ${String(error)}`,
      );
    }
  }

  try {
    const local = (await importModule("@contfu/media-optimizer")) as {
      M4kOptimizer: new () => MediaOptimizer;
    };
    return new local.M4kOptimizer();
  } catch (error) {
    throw new Error(
      `Failed to load @contfu/media-optimizer. Install the optional dependency or set M4K_URL. ${String(error)}`,
    );
  }
}

export async function handleAssetRequest(
  request: RouteRequest,
  options: ServerAssetOptions = {},
): Promise<Response> {
  const url = new URL(request.url);
  const filePath = decodeURIComponent(request.params.path);
  const parsed = parseAssetPath(filePath);
  const assetStore = await getAssetStore(options);

  if (!parsed) {
    const asset = getAsset(filePath);
    if (!asset) return text("Not found", 404);

    const data = await assetStore.read(`${asset.id}.${asset.ext}`);
    if (!data) return text("Not found", 404);

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeTypes[asset.ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const contentType = mimeTypes[parsed.ext] ?? "application/octet-stream";
  const mediaType = mediaTypeFromExt(parsed.ext);
  const opts = buildAssetOpts(url, mediaType);

  if (!opts || mediaType === null) {
    const data = await assetStore.read(filePath);
    if (!data) return text("Not found", 404);

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  try {
    const mediaOptimizer = await getMediaOptimizer(options);
    const stream = await loadAsset(filePath, opts, {
      assetStore,
      mediaOptimizer,
      cache: options.cache ?? true,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof AssetLoadError) {
      return text(error.message, error.status);
    }
    throw error;
  }
}
