export interface MediaStore {
  exists(canonical: string): Promise<boolean>;
  write(canonical: string, buffer: Blob): Promise<void>;
  read(canonical: string): Promise<Blob | null>;
}

export interface MediaOptimizer {
  optimizeImage(
    canonical: string,
    buffer: Blob,
    store: MediaStore,
    widths?: number[]
  ): Promise<void>;
}
