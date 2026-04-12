/**
 * AssetStore interface for storing and retrieving any asset files.
 * Media assets are a special case handled on top of this generic store.
 */
export interface AssetStore {
  write(path: string, data: Buffer | ReadableStream): void | Promise<void>;
  read(path: string): Buffer | null | Promise<Buffer | null>;
  exists(path: string): boolean | Promise<boolean>;
}
