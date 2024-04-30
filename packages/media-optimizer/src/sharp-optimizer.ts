import type {
  ImageFormat,
  MediaOptimizer,
  MediaStore,
  OptimizeImageOpts,
} from "@contfu/client";
import { basename, extname } from "path";
import sharp from "sharp";
import { Readable } from "stream";

export class SharpOptimizer implements MediaOptimizer {
  private store: MediaStore;
  constructor({ store }: { store: MediaStore }) {
    this.store = store;
  }
  async optimizeImage(
    canonical: string,
    input: Buffer | ReadableStream,
    opts: OptimizeImageOpts = { avif: [[]] }
  ) {
    const base = basename(canonical, extname(canonical));
    const s =
      input instanceof Buffer ? sharp(input) : sharp({ failOnError: false });
    const promises: Promise<void>[] = [];
    for (const [format, entries] of Object.entries(opts)) {
      for (const entry of entries) {
        const [width, height, quality] = (
          typeof entry === "number" ? [entry] : entry
        ).map((v) => v ?? undefined);
        const w = width ? `w${width}` : "";
        const h = height ? `h${height}` : "";
        promises.push(
          s
            .clone()
            .resize({ width, height })
            .toFormat(format as ImageFormat, { quality })
            .toBuffer()
            .then((buffer) =>
              this.store.write(
                `${base}${w || h ? "/" : ""}${w}${h}.${format}`,
                buffer
              )
            )
        );
      }
    }
    if (!(input instanceof Buffer)) {
      Readable.fromWeb(input).pipe(s);
    }
    await Promise.all(promises);
  }
}
