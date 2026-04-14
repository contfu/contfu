/**
 * FileStore interface for storing and retrieving any file files.
 * Media files are a special case handled on top of this generic store.
 */
export interface FileStore {
  write(path: string, data: Buffer | ReadableStream): void | Promise<void>;
  read(path: string): Buffer | null | Promise<Buffer | null>;
  exists(path: string): boolean | Promise<boolean>;
}
