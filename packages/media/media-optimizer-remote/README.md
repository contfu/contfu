# @contfu/media-optimizer-remote

Remote media optimization for Contfu via the m4k HTTP API.

Delegates image, audio, and video processing to a dedicated m4k service. Use this for horizontal scalability — offload media processing to one or more remote workers instead of running it in the application process.

## Usage

Pass the optimizer to `connect()` from `@contfu/contfu`:

```ts
import { connect } from "@contfu/contfu";
import { M4kRemoteOptimizer } from "@contfu/media-optimizer-remote";

for await (const event of connect({
  mediaOptimizer: new M4kRemoteOptimizer({ url: "http://m4k:8080" }),
})) {
  // media is optimized by the remote m4k service during sync
}
```

For single-instance deployments, use `@contfu/media-optimizer` to process locally.
