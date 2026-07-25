import { eq } from "drizzle-orm";
import { FileStatus } from "../../domain/file-status";
import type {
  MediaMasterConfig,
  MediaOptimizer,
  MediaVariants,
  TransformMediaRule,
} from "../../domain/media";
import { db } from "../../infra/db/db";
import {
  fileTable,
  itemFileTable,
  itemsTable,
  mediaMasterTable,
  mediaVariantTable,
} from "../../infra/db/schema";
import { encodeId } from "../../infra/ids";
import { mediaMastersEnabled } from "./mediaMasterConfig";
import { mediaConfigFingerprint } from "./mediaConfigFingerprint";
import { resolvePregenerate } from "./resolvePregenerate";

export async function reconcileMediaMasters(args: {
  mediaOptimizer?: MediaOptimizer;
  mediaMaster?: false | MediaMasterConfig;
  transformMedia?: TransformMediaRule[];
  mediaVariants?: MediaVariants;
  rederive: (
    file: typeof fileTable.$inferSelect,
    master: typeof mediaMasterTable.$inferSelect,
  ) => Promise<void>;
  onMissingMaster?: (file: typeof fileTable.$inferSelect) => void;
}): Promise<void> {
  if (!mediaMastersEnabled(args.mediaMaster)) return;
  const rows = db
    .select({ file: fileTable, master: mediaMasterTable, collection: itemsTable.collection })
    .from(fileTable)
    .leftJoin(mediaMasterTable, eq(mediaMasterTable.fileId, fileTable.id))
    .leftJoin(itemFileTable, eq(itemFileTable.fileId, fileTable.id))
    .leftJoin(itemsTable, eq(itemsTable.id, itemFileTable.itemId))
    .where(eq(fileTable.status, FileStatus.Ready))
    .all();

  const seen = new Set<string>();
  for (const row of rows) {
    const id = encodeId(row.file.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const meta = { ...row.file.meta };
    if (!meta.collection && row.collection) meta.collection = row.collection;
    if (args.transformMedia !== undefined) meta.transformMedia = args.transformMedia;
    if (args.mediaVariants !== undefined)
      meta.pregenerate = resolvePregenerate(
        typeof meta.collection === "string" ? meta.collection : undefined,
        args.mediaVariants,
      );
    if (!row.master) {
      args.onMissingMaster?.({ ...row.file, meta });
      continue;
    }
    const next = mediaConfigFingerprint(meta, row.file.mediaType, args.mediaMaster);
    if (next === row.master.configFingerprint) continue;
    db.delete(mediaVariantTable).where(eq(mediaVariantTable.fileId, row.file.id)).run();
    await args.rederive({ ...row.file, meta }, row.master);
  }
}
