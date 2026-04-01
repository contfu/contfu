# @contfu/bun-file-store

File-based `MediaStore` implementation for Contfu, using Bun's native file APIs.

Stores synced media assets on the local filesystem or in an S3-compatible bucket. Use this when you need assets written to disk or object storage rather than the default in-database storage.

## Usage

Pass the store to `connect()` from `@contfu/contfu`:

```ts
import { connect } from "@contfu/contfu";
import { FileStore } from "@contfu/bun-file-store";

const store = new FileStore("/var/contfu/media");
// or S3:
const store = new FileStore("s3://my-bucket/media");

for await (const event of connect({ mediaStore: store })) {
  // media files are written to the store during sync
}
```

S3 paths (`s3://...`) use Bun's native S3 support.
