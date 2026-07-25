import type {
  MediaConvertOpts,
  MediaMasterConfig,
  MediaVariants,
  MediaVariantsConfig,
} from "../../domain/media";
import { hashObject } from "../../infra/hash";

export function mediaMastersEnabled(config: false | MediaMasterConfig | undefined): boolean {
  return config !== false;
}

export function masterConfigFor(
  config: false | MediaMasterConfig | undefined,
  mediaType: string,
): MediaConvertOpts | false | undefined {
  if (config === false) return false;
  if (mediaType === "image")
    return config?.image === false
      ? false
      : { mediaType: "image", format: "avif", quality: 90, ...config?.image };
  if (mediaType === "video")
    return config?.video === false
      ? false
      : {
          mediaType: "video",
          format: "mp4",
          ext: "mp4",
          videoCodec: "libx264",
          audioCodec: "aac",
          ...config?.video,
        };
  if (mediaType === "audio")
    return config?.audio === false
      ? false
      : {
          mediaType: "audio",
          format: "opus",
          ext: "opus",
          codec: "libopus",
          bitrate: "160k",
          ...config?.audio,
        };
  return false;
}

export function mediaConfigFingerprint(
  meta: Record<string, unknown>,
  mediaType: string,
  mediaMaster: false | MediaMasterConfig | undefined,
): number {
  return hashObject({
    master: masterConfigFor(mediaMaster, mediaType),
    transformMedia: meta.transformMedia,
    pregenerate: meta.pregenerate,
    collection: meta.collection,
  });
}

export function resolvePregenerate(
  collection: string | undefined,
  mediaVariants?: MediaVariants,
): MediaConvertOpts[] | undefined {
  if (!mediaVariants) return undefined;
  const byCollection = mediaVariants.collections as Record<string, MediaVariantsConfig> | undefined;
  const config = (collection ? byCollection?.[collection] : undefined) ?? mediaVariants.default;
  if (!config?.pregenerate?.length) return undefined;
  const resolved = config.pregenerate.map((name) => config.presets[name]).filter(Boolean);
  return resolved.length > 0 ? resolved : undefined;
}
