import { resolve } from "path";
import { MediaStore } from "./media";

export class FileStore implements MediaStore {
  constructor(private _root: string) {}
  async write(canonical: string, buffer: Blob): Promise<void> {
    await Bun.write(resolve(this._root, canonical), buffer);
  }
  async read(canonical: string): Promise<Blob | null> {
    const file = Bun.file(resolve(this._root, canonical));
    return (await file.exists()) ? file : null;
  }
  async exists(canonical: string): Promise<boolean> {
    return Bun.file(resolve(this._root, canonical)).exists();
  }
}
