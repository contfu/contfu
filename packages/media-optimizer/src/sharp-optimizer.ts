import type { ImageFormat, MediaOptimizer, MediaStore } from "@contfu/client";
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
    {
      widths,
      formats = ["avif"],
    }: { widths?: number[]; formats?: ImageFormat[] } = {}
  ) {
    const base = basename(canonical, extname(canonical));
    const s =
      input instanceof Buffer ? sharp(input) : sharp({ failOnError: false });
    const { width } =
      input instanceof Buffer ? await s.metadata() : ({} as { width?: number });
    const promises: Promise<void>[] = [];
    for (const format of formats) {
      if (widths) {
        for (const w of widths) {
          if (!width || w < width) {
            promises.push(
              s
                .clone()
                .resize(w)
                .toFormat(format)
                .toBuffer()
                .then((buffer) =>
                  this.store.write(`${base}/${w}.${format}`, buffer)
                )
            );
          }
        }
      } else
        promises.push(
          s
            .clone()
            .toFormat(format)
            .toBuffer()
            .then((buffer) => this.store.write(`${base}.${format}`, buffer))
        );
    }
    if (!(input instanceof Buffer)) {
      Readable.fromWeb(input).pipe(s);
    }
    await Promise.all(promises);
  }
}
