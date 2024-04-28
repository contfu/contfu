import { resolve } from "path";
import { type MediaStore } from "./media";

export class FileStore implements MediaStore {
  constructor(private _root: string) {}
  async write(canonical: string, buffer: Buffer): Promise<void> {
    const target = resolve(this._root, canonical);
    await Bun.write(target, buffer);
  }
  async read(canonical: string): Promise<Buffer | null> {
    const file = Bun.file(resolve(this._root, canonical));
    return (await file.exists()) ? Buffer.from(await file.arrayBuffer()) : null;
  }
  async exists(canonical: string): Promise<boolean> {
    return Bun.file(resolve(this._root, canonical)).exists();
  }
}
