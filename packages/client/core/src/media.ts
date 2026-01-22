export interface MediaStore {
  exists(canonical: string): Promise<boolean>;
  write(canonical: string, input: Buffer | ReadableStream): Promise<void>;
  read(canonical: string): Promise<Buffer | null>;
}

export type ImageFormat = "avif" | "webp" | "jpeg" | "png";

type ImageTransformOpts =
  | number
  | [width?: number | null, height?: number | null, quality?: number | null];

export type OptimizeImageOpts = Partial<
  Record<ImageFormat, [ImageTransformOpts, ...ImageTransformOpts[]]>
>;

export interface MediaOptimizer {
  optimizeImage(
    store: MediaStore,
    canonical: string,
    input: Buffer | ReadableStream,
    opts?: OptimizeImageOpts,
  ): Promise<void>;
}
