export interface MediaStore {
  exists(canonical: string): Promise<boolean>;
  write(canonical: string, input: Buffer | ReadableStream): Promise<void>;
  read(canonical: string): Promise<Buffer | null>;
}

export type ImageFormat = "avif" | "webp" | "jpeg" | "png";

export interface MediaOptimizer {
  optimizeImage(
    canonical: string,
    input: Buffer | ReadableStream,
    opts?: { widths?: number[]; formats?: ImageFormat[] }
  ): Promise<void>;
}
