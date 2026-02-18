# @contfu/contfu

Client package organized with vertical slices and feature modules.

## Structure

- `src/features/*`: business feature slices with one use-case module per file
- `src/infra/*`: shared infrastructure (`db`, `sync`, `hooks`)
- `src/util/*`: pure utilities

## Naming

- `items` is the canonical content terminology.
- Page compatibility aliases have been removed.
