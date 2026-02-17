# @contfu/contfu

Client package organized with vertical slices.

## Structure

- `src/features/*`: business feature slices (`items`, `assets`, `connections`, `collections`, `media`)
- `src/infra/*`: shared infrastructure (`db`, `sync`, `hooks`)
- `src/util/*`: pure utilities

## Naming

- `items` is the canonical content terminology.
- Legacy `pages` API names are still exported as deprecated aliases for backward compatibility.
