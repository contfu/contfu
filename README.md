# contfu

Open-source packages for building content-driven applications with [contfu](https://contfu.com).

## Packages

| Package                                                                    | Description                                  |
| -------------------------------------------------------------------------- | -------------------------------------------- |
| [`@contfu/core`](packages/core)                                            | Core types and utilities                     |
| [`@contfu/client`](packages/client/client)                                 | Client SDK for querying and managing content |
| [`@contfu/connect`](packages/client/connect)                               | Real-time connection and streaming           |
| [`@contfu/cli`](packages/cli)                                              | Command-line interface                       |
| [`@contfu/bun-file-store`](packages/client/bun-file-store)                 | File storage adapter for Bun                 |
| [`@contfu/media-optimizer`](packages/client/media-optimizer)               | Local media optimization                     |
| [`@contfu/media-optimizer-remote`](packages/client/media-optimizer-remote) | Remote media optimization                    |
| [`@contfu/svc-core`](packages/service/core)                                | Service API types                            |

## Getting started

```bash
bun install
bun run build
bun run test
```

## Development

This repository uses [Bun](https://bun.sh) as the package manager and runtime.

```bash
bun run check    # format, build, lint, typecheck, test
bun run fmt      # format code
bun run lint     # lint
bun run typecheck # type check
bun run test     # unit tests
```

## License

[MIT](LICENSE)
