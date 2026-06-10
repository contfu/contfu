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

For horizontally scaled deployments, use `@contfu/media-optimizer-remote` instead.
