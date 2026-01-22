export interface MediaStore {
  write(name: string, data: ReadableStream): Promise<void>;
  read(name: string): Promise<Buffer>;
  exists(name: string): Promise<boolean>;
}
