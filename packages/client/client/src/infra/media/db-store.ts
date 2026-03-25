import { eq } from "drizzle-orm";
import type { MediaStore } from "../../features/media/media";
import { db } from "../db/db";
import { decodeId } from "../ids";
import { assetTable } from "../db/schema";

export class DBStore implements MediaStore {
  async write(path: string, data: Buffer | ReadableStream): Promise<void> {
    const id = this.idFromPath(path);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(await new Response(data).arrayBuffer());
    db.update(assetTable)
      .set({ data: buf })
      .where(eq(assetTable.id, decodeId(id)))
      .run();
  }

  read(path: string): Buffer | null {
    const id = this.idFromPath(path);
    const rows = db
      .select({ data: assetTable.data })
      .from(assetTable)
      .where(eq(assetTable.id, decodeId(id)))
      .all();
    return rows.length > 0 ? (rows[0].data ?? null) : null;
  }

  exists(path: string): boolean {
    const id = this.idFromPath(path);
    const rows = db
      .select({ id: assetTable.id })
      .from(assetTable)
      .where(eq(assetTable.id, decodeId(id)))
      .all();
    return rows.length > 0;
  }

  /** Extract id from path key like "${id}.${ext}" */
  private idFromPath(path: string): string {
    const dotIdx = path.lastIndexOf(".");
    return dotIdx !== -1 ? path.slice(0, dotIdx) : path;
  }
}
