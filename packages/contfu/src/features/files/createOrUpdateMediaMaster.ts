import type { MediaMasterConfig, MediaOptimizer } from "../../domain/media";
import { db } from "../../infra/db/db";
import { mediaMasterTable } from "../../infra/db/schema";
import { encodeId } from "../../infra/ids";
import { masterConfigFor } from "./masterConfigFor";
import { mediaConfigFingerprint } from "./mediaConfigFingerprint";
import { toOptimizerOpts } from "./mediaMasterOptimize";

type MediaType = "image" | "video" | "audio";

export async function createOrUpdateMediaMaster(args: {
  fileId: Buffer;
  input: Buffer;
  mediaType: string;
  originalExt: string;
  meta: Record<string, unknown>;
  mediaOptimizer?: MediaOptimizer;
  mediaMaster?: false | MediaMasterConfig;
}): Promise<{
  data: Buffer;
  ext: string;
  metadata: Record<string, unknown>;
  fingerprint: number;
} | null> {
  const config = masterConfigFor(args.mediaMaster, args.mediaType);
  if (!config) return null;

  const fingerprint = mediaConfigFingerprint(args.meta, args.mediaType, args.mediaMaster);
  const targetExt = config.ext ?? config.format ?? args.originalExt;
  let data = args.input;
  let ext = targetExt;
  let metadata: Record<string, unknown> = {
    fallback: false,
    sourceExt: args.originalExt,
    sourceSize: args.input.byteLength,
  };

  try {
    if (!args.mediaOptimizer) throw new Error("Media optimizer unavailable");
    const results = await args.mediaOptimizer.optimize(
      `${encodeId(args.fileId)}.master.${targetExt}`,
      args.input,
      args.mediaType as MediaType,
      toOptimizerOpts(targetExt, args.mediaType as MediaType, config),
    );
    if (!results[0]) throw new Error("No master output produced");
    data = results[0].data;
    ext = results[0].ext || targetExt;
    metadata = {
      ...metadata,
      width: results[0].width,
      height: results[0].height,
      quality: results[0].quality,
      size: results[0].size,
    };
  } catch (error) {
    data = args.input;
    ext = args.originalExt;
    metadata = {
      ...metadata,
      fallback: true,
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }

  const now = Math.floor(Date.now() / 1000);
  db.insert(mediaMasterTable)
    .values({
      fileId: args.fileId,
      mediaType: args.mediaType,
      ext,
      format: ext,
      configFingerprint: fingerprint,
      metadata,
      data,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: mediaMasterTable.fileId,
      set: {
        mediaType: args.mediaType,
        ext,
        format: ext,
        configFingerprint: fingerprint,
        metadata,
        data,
        updatedAt: now,
      },
    })
    .run();

  return { data, ext, metadata, fingerprint };
}
