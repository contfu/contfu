import type {
  AudioConvertOpts,
  MediaConvertOpts,
  OptimizeAudioOpts,
  OptimizeImageOpts,
  OptimizeVideoOpts,
  VideoConvertOpts,
} from "../../domain/media";

type MediaType = "image" | "video" | "audio";

export function toOptimizerOpts(
  ext: string,
  mediaType: MediaType,
  opts: MediaConvertOpts,
): OptimizeImageOpts | OptimizeVideoOpts | OptimizeAudioOpts {
  if (mediaType === "image") {
    const img = opts as Extract<MediaConvertOpts, { mediaType?: "image" }>;
    return {
      [ext]: [[img.resize?.width, img.resize?.height, img.quality]],
      base: {
        rotate: img.rotate,
        crop: img.crop,
        keepMetadata: img.keepMetadata,
        keepExif: img.keepExif,
        keepIcc: img.keepIcc,
        colorspace: img.colorspace,
      },
    } satisfies OptimizeImageOpts;
  }
  if (mediaType === "video") {
    const v = opts as VideoConvertOpts;
    return { format: ext, ext, ...v } satisfies OptimizeVideoOpts;
  }
  const a = opts as AudioConvertOpts;
  return { format: ext, ext, ...a } satisfies OptimizeAudioOpts;
}
