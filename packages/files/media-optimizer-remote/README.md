# @contfu/media-optimizer-remote

Remote Media File optimization for Contfu via the m4k HTTP API.

Delegates image, audio, and video processing from the Local Runtime to a dedicated, application-operated m4k service. Use this for horizontal scalability — offload media processing to one or more remote workers that you run as part of your application infrastructure. This is not a managed Cloud Service media feature.

## Usage

Pass the optimizer to `connect()` from `@contfu/contfu`:

```ts
import { connect } from "@contfu/contfu";
import { M4kRemoteOptimizer } from "@contfu/media-optimizer-remote";

for await (const event of connect({
  mediaOptimizer: new M4kRemoteOptimizer({ url: "http://m4k:8080" }),
})) {
  // Media Files are optimized by your application-operated m4k service during Local Runtime sync
}
```

For single-instance deployments, use `@contfu/media-optimizer` to process locally.
