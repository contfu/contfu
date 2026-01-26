/**
 * MediaStore interface for storing and retrieving media files.
 */
export interface MediaStore {
  write(canonical: string, data: Buffer | ReadableStream): Promise<void>;
  read(canonical: string): Promise<Buffer | null>;
  exists(canonical: string): Promise<boolean>;
}

/**
 * Supported image formats for optimization.
 */
export type ImageFormat = "avif" | "webp" | "jpeg" | "png";

/**
 * Options for image optimization.
 * Keys are format names, values are arrays of [width, height?, quality?] tuples.
 */
export type OptimizeImageOpts = Partial<
  Record<ImageFormat, (number | [number?, number?, number?])[]>
>;

/**
 * MediaOptimizer interface for optimizing images.
 */
export interface MediaOptimizer {
  optimizeImage(
    store: MediaStore,
    canonical: string,
    input: Buffer | ReadableStream,
    opts?: OptimizeImageOpts,
  ): Promise<void>;
}
