import { eq } from "drizzle-orm";
import type { MediaMasterConfig, VariantResult } from "../../domain/media";
import { db } from "../../infra/db/db";
import { fileTable, mediaMasterTable } from "../../infra/db/schema";
import { encodeId } from "../../infra/ids";
import { mediaConfigFingerprint } from "./mediaConfigFingerprint";

export async function rederiveFileFromMediaMaster(args: {
  file: typeof fileTable.$inferSelect;
  master: typeof mediaMasterTable.$inferSelect;
  optimize: (
    storeKey: string,
    input: Buffer,
    mediaType: string,
    originalExt: string,
    meta: Record<string, unknown>,
  ) => Promise<{ data: Buffer; ext: string; variants: VariantResult[] }>;
  writeOutputs?: (
    id: string,
    processed: { data: Buffer; ext: string; variants: VariantResult[] },
  ) => Promise<void>;
  mediaMaster?: false | MediaMasterConfig;
}): Promise<void> {
  const id = encodeId(args.file.id);
  const meta = args.file.meta ?? {};
  const originalExt =
    typeof args.master.metadata?.sourceExt === "string"
      ? args.master.metadata.sourceExt
      : args.master.ext;
  const processed = await args.optimize(
    `${id}.${args.master.ext}`,
    args.master.data,
    args.file.mediaType,
    originalExt,
    meta,
  );
  await args.writeOutputs?.(id, processed);
  const nextFingerprint = mediaConfigFingerprint(meta, args.file.mediaType, args.mediaMaster);
  db.update(fileTable)
    .set({
      data: processed.data,
      meta: {
        ...meta,
        ext: processed.ext,
        attempts: typeof meta.attempts === "number" ? meta.attempts : 1,
        mediaMaster: {
          ext: args.master.ext,
          configFingerprint: nextFingerprint,
          metadata: args.master.metadata,
        },
      },
    })
    .where(eq(fileTable.id, args.file.id))
    .run();
  db.update(mediaMasterTable)
    .set({
      configFingerprint: nextFingerprint,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(mediaMasterTable.fileId, args.file.id))
    .run();
}
