import { type MediaStore } from "contfu";
import { resolve } from "path";

export class FileStore implements MediaStore {
  constructor(private _root: string) {}
  async write(canonical: string, data: Buffer | ReadableStream): Promise<void> {
    const target = resolve(this._root, canonical);
    // Bun.write accepts both Buffer and ReadableStream
    if (Buffer.isBuffer(data)) {
      await Bun.write(target, data);
    } else {
      // Use Response to wrap the stream for Bun compatibility
      await Bun.write(target, new Response(data));
    }
  }
  async read(canonical: string): Promise<Buffer | null> {
    const file = Bun.file(resolve(this._root, canonical));
    return (await file.exists()) ? Buffer.from(await file.arrayBuffer()) : null;
  }
  async exists(canonical: string): Promise<boolean> {
    return Bun.file(resolve(this._root, canonical)).exists();
  }
}
