# @contfu/media-optimizer

Local Runtime Media File optimization for Contfu using the [m4k](https://m4k.dev) library.

Processes images, audio, and video locally inside the application boundary during Local Runtime sync. Use this to generate optimized variants (resized images, transcoded video) without an external service.

## Usage

Pass the optimizer to `connect()` from `@contfu/contfu`:

```ts
import { connect } from "@contfu/contfu";
import { M4kOptimizer } from "@contfu/media-optimizer";

for await (const event of connect({ mediaOptimizer: new M4kOptimizer() })) {
  // Media Files are optimized automatically by the Local Runtime
}
```

You can also use the local m4k transform for one-off conversions through `convertMedia()`:

```ts
import { convertMedia } from "@contfu/contfu";
import { createTransform } from "@contfu/media-optimizer";

const output = await convertMedia(
  fileId,
  "webp",
  { mediaType: "image", format: "webp", resize: { width: 1200 } },
  createTransform(),
);
```

Both sync-time optimization and one-off conversion honor the same image, video, and audio transform options exposed by `@contfu/contfu`.

For horizontally scaled deployments, use `@contfu/media-optimizer-remote` instead.
