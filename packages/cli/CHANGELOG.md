# Changelog

## [0.1.4] - 2026-06-30

### Changed

- Updated dependencies.

## [0.1.3] - 2026-06-27

### Fixed

- Pinned internal @contfu dependency ranges to the matching release version so published packages resolve required exports.

## [0.1.2] - 2026-06-26

### Added

- Added CLI support for explicit Contentful Delivery/Preview API mode setup.
- Added WordPress application-password credentials and draft-mode setup flags.
- Added `--search` support to item query/count commands.
- Added i18n locale and fallback overrides to item query/count commands.
- Added documented `contfu integrations add --select` support.
- Added webhook target header and retry/window settings support.

### Fixed

- Fixed organization invitation acceptance dry-run handling.
- Fixed WordPress, Contentful, integration secret rotation, flow creation, and rich-content CLI flag handling.
- Rejected unsupported package names, unknown integration provider types, invalid i18n fallback grouping keys, and conflicting content flags.
- Normalized collection flow counts and covered CLI endpoints.

All notable changes to `@contfu/cli` are documented here.

## [0.1.1] - 2026-06-14

### Added

- Added CLI resource management for integration localization, dry-run output, and expanded organization/workspace commands.

### Changed

- Renamed connection-oriented public APIs and UI labels toward integrations.

## [0.1.0] - 2026-06-09

### Changed

- Bumped package minor version.

## [0.0.12] - 2026-04-18

### Added

- `--content` / `--no-content` flag on `collection create` to control whether content is included in the collection

## [0.0.11] - 2026-04-16

### Changed

- Updated dependencies

## [0.0.10] - 2026-04-14

Initial public release.
