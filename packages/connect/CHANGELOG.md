# Changelog

## [0.1.8] - 2026-08-22

### Changed

- Updated compatible dependencies and remediated security vulnerabilities.

### Fixed

- Cleared failed file-lease timers.
- Made local sync event persistence atomic.

## [0.1.7] - 2026-08-10

### Added

- Added managed-file lease delivery over WebSocket.
- Added Notion file lease prewarming and stable file URLs.
- Added authenticated managed file downloads.

## [0.1.6] - 2026-08-05

### Fixed

- Hardened local runtime reliability and stream reconnection behavior.

## [0.1.5] - 2026-07-25

### Added

- Added application refresh command protocol support.

### Changed

- Documented local media reprocessing and refresh repair.
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

- Tightened public sync transport and endpoint configuration.

### Fixed

- Aligned reconnect behavior with the documented public API.

All notable changes to `@contfu/connect` are documented here.

## [0.1.0] - 2026-06-09

### Changed

- Bumped package minor version.

## [0.0.7] - 2026-04-18

### Added

- Buffered normalized source-event aggregation for cleaner adapter behavior

### Changed

- Tightened stream-client reconnect sequencing

## [0.0.6] - 2026-04-14

Initial public release.
