import { eq } from "drizzle-orm";
import type { MediaStore } from "../../features/media/media";
import { db } from "../db/db";
import { decodeId } from "../ids";
import { assetTable } from "../db/schema";

export class DBStore implements MediaStore {
  async write(path: string, data: Buffer | ReadableStream): Promise<void> {
    const id = this.idFromPath(path);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(await new Response(data).arrayBuffer());
    await db
      .update(assetTable)
      .set({ data: buf })
      .where(eq(assetTable.id, decodeId(id)));
  }

  async read(path: string): Promise<Buffer | null> {
    const id = this.idFromPath(path);
    const rows = await db
      .select({ data: assetTable.data })
      .from(assetTable)
      .where(eq(assetTable.id, decodeId(id)));
    return rows.length > 0 ? (rows[0].data ?? null) : null;
  }

  async exists(path: string): Promise<boolean> {
    const id = this.idFromPath(path);
    const rows = await db
      .select({ id: assetTable.id })
      .from(assetTable)
      .where(eq(assetTable.id, decodeId(id)));
    return rows.length > 0;
  }

  /** Extract id from path key like "${id}.${ext}" */
  private idFromPath(path: string): string {
    const dotIdx = path.lastIndexOf(".");
    return dotIdx !== -1 ? path.slice(0, dotIdx) : path;
  }
}
