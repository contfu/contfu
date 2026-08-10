# Changelog

## [0.3.2] - 2026-08-10

### Added

- Added managed-file lease delivery over WebSocket.
- Added Notion file lease prewarming and stable file URLs.
- Added file metadata derivation from download responses.
- Added authenticated managed file downloads.
- Added support for resolving Notion page links as internal references.

## [0.3.1] - 2026-08-05

### Added

- Added plain-date support and preserved nullable enum unions in generated types.

### Changed

- Renamed the `json` property type to `object`.
- Pruned stale file links when item media changes.

### Fixed

- Hardened local runtime reliability and aligned DATE type generation with epoch-millisecond values.

## [0.3.0] - 2026-07-25

### Changed

- **Breaking:** Regenerated the complete local-store migration history. Existing local databases must be deleted and rebuilt from a fresh sync before upgrading.

## [0.2.2] - 2026-07-25

### Added

- Added Directus integration support.
- Added refresh-based media repair and canonical media masters for local reprocessing.
- Added application refresh command protocol support.
- Preserved Notion emoji page icons.

### Changed

- Documented local media reprocessing and refresh repair.
- Enforced vertical-slice boundaries.
- Upgraded TypeScript.

## [0.2.1] - 2026-07-01

### Added

- Preserve deleted local items.

## [0.2.0] - 2026-06-30

### Changed

- Breaking: changed query client file metadata results to return typed metadata.

## [0.1.3] - 2026-06-28

### Fixed

- Omitted binary file data from file query results and persisted image dimensions.

## [0.1.2] - 2026-06-27

### Fixed

- Pinned internal @contfu dependency ranges to the matching release version so published packages resolve required exports.

## [0.1.1] - 2026-06-26

### Fixed

- Implemented flat query options for local/runtime queries.
- Removed the stale `$integrationType` application query system field.
- Exposed documented node/shared entry points.
- Aligned i18n fallback handling with the spec.

All notable changes to `@contfu/contfu` are documented here.

## [0.1.0] - 2026-06-09

### Changed

- Bumped package minor version.

## [0.0.11] - 2026-04-18

### Changed

- Updated dependencies

## [0.0.10] - 2026-04-18

### Added

- Named media variant presets: define reusable transforms (e.g. `thumbnail`, `hero`) and serve them on-demand via URL parameters
- `pregenerate` option to pre-generate specified presets at sync time
- `strict` mode to reject file uploads that don't match a defined preset
- Configurable file URL handling
- New media optimization guide (`docs/media-optimization.md`)
- Buffered source-event aggregation in the stream/connect pipeline

### Changed

- Image transform `constraints` renamed to `rules`

## [0.0.9] - 2026-04-16

### Added

- HTTP infrastructure for file handling

### Changed

- `contfu()` now returns a `ContfuInstance` object with all methods attached, enabling tree-shakeable usage
- "Assets" renamed to "files" throughout the package

## [0.0.8] - 2026-04-14

Initial public release.
