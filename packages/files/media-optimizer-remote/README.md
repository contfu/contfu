# @contfu/media-optimizer-remote

Remote Media File optimization for Contfu via the m4k HTTP API.

Delegates image, audio, and video processing from the Contfu runtime to a dedicated, application-operated m4k service. Use this for horizontal scalability — offload media processing to one or more remote workers that you run as part of your application infrastructure. This is not a managed Contfu media feature.

## Usage

Pass the optimizer to `connect()` from `@contfu/contfu`:

```ts
import { connect } from "@contfu/contfu";
import { M4kRemoteOptimizer } from "@contfu/media-optimizer-remote";

for await (const event of connect({
  mediaOptimizer: new M4kRemoteOptimizer({ url: "http://m4k:8080" }),
})) {
  // Media Files are optimized by your application-operated m4k service during Contfu runtime synchronization
}
```

You can also pass the m4k host URL directly as a string.

For one-off conversions through `convertMedia()`, use the same options shape with `createTransform()`:

```ts
import { convertMedia } from "@contfu/contfu";
import { createTransform } from "@contfu/media-optimizer-remote";

const transform = createTransform({ url: "http://m4k:8080" });
const output = await convertMedia(
  fileId,
  "webp",
  { mediaType: "image", format: "webp" },
  transform,
);
```

For single-instance deployments, use `@contfu/media-optimizer` to process locally.
