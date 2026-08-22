# Changelog

## [0.1.9] - 2026-08-22

### Added

- Applied mapping defaults to null values.

### Changed

- Updated compatible dependencies and remediated security vulnerabilities.

### Fixed

- Made delivery incidents actionable.
- Consolidated delivery incidents.
- Aligned mapping schemas with primitive casts.
- Rejected non-finite number mapping results.
- Validated multi-value enum mappings element by element.

## [0.1.8] - 2026-08-12

### Added

- Enforced per-collection item quotas.

### Fixed

- Compared array-valued filter properties by sequence.

## [0.1.7] - 2026-08-10

### Changed

- Updated dependencies.

## [0.1.6] - 2026-08-05

### Added

- Added plain-date schema support.

### Fixed

- Bounded paid item change quota overages.

## [0.1.5] - 2026-07-25

### Added

- Added Directus integration support.
- Added collection options for Strapi route names.
- Preserved Notion emoji page icons and normalized creation timestamps.

### Changed

- Upgraded TypeScript.

## [0.1.4] - 2026-07-01

### Changed

- Updated dependencies.

## [0.1.3] - 2026-06-30

### Changed

- Updated dependencies.

## [0.1.2] - 2026-06-27

### Fixed

- Pinned internal @contfu dependency ranges to the matching release version so published packages resolve required exports.

## [0.1.1] - 2026-06-26

### Added

- Added webhook target static headers and retry/window settings.
- Buffered source pushes during repair and staged reset source state.
- Added webhook integrations and integration role/capability metadata.

### Changed

- Renamed repair controls to source sync language.
- Improved actionable incident details and incident resolution modes.

All notable changes to `@contfu/svc-core` are documented here.

## [0.1.0] - 2026-06-09

### Changed

- Bumped package minor version.

## [0.0.10] - 2026-04-18

### Added

- `includeContent` flag in collection schema

### Changed

- API and schema definitions updated to support named media variant preset configuration

## [0.0.9] - 2026-04-14

Initial public release.
