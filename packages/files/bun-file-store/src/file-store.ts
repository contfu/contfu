import type { FileStore } from "@contfu/contfu";
import { resolve } from "node:path";

function joinPath(root: string, canonical: string): string {
  if (root.startsWith("s3://")) {
    const base = root.endsWith("/") ? root : `${root}/`;
    return `${base}${canonical}`;
  }
  return resolve(root, canonical);
}

export class BunFileStore implements FileStore {
  constructor(private _root: string) {}
  async write(canonical: string, data: Buffer | ReadableStream): Promise<void> {
    const target = joinPath(this._root, canonical);
    // Bun.write accepts both Buffer and ReadableStream
    if (Buffer.isBuffer(data)) {
      await Bun.write(target, data);
    } else {
      // Use Response to wrap the stream for Bun compatibility
      await Bun.write(target, new Response(data));
    }
  }
  async read(canonical: string): Promise<Buffer | null> {
    const file = Bun.file(joinPath(this._root, canonical));
    return (await file.exists()) ? Buffer.from(await file.arrayBuffer()) : null;
  }
  exists(canonical: string): Promise<boolean> {
    return Bun.file(joinPath(this._root, canonical)).exists();
  }
}
