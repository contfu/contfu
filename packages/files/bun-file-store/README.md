# @contfu/bun-file-store

File-based `FileStore` implementation for Contfu, using Bun's native file APIs.

Stores synced files on the local filesystem or in an S3-compatible bucket. Use this when you need files written to disk or object storage rather than the default in-database storage.

## Usage

Pass the store to `connect()` from `@contfu/contfu`:

```ts
import { connect } from "@contfu/contfu";
import { BunFileStore } from "@contfu/bun-file-store";

const store = new BunFileStore("/var/contfu/files");
// or S3:
const store = new BunFileStore("s3://my-bucket/files");

for await (const event of connect({ fileStore: store })) {
  // files are written to the store during sync
}
```

S3 paths (`s3://...`) use Bun's native S3 support.
