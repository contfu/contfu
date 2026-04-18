# Changelog

All notable changes to `@contfu/contfu` are documented here.

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
