# @contfu/server

Bun HTTP server for the Contfu content API.

Exposes a data query API and live-event stream over HTTP. Use this to serve content to `@contfu/client` consumers or any HTTP client.

## Usage

```ts
import serve from "@contfu/server";

serve({ port: 3000 });
```

Or compose with your own `Bun.serve` call:

```ts
import { createServeOptions } from "@contfu/server";

Bun.serve({
  ...createServeOptions(),
  port: 3000,
});
```

## Prerequisites

Requires `@contfu/contfu` to be configured (database, sync settings) via environment variables.
