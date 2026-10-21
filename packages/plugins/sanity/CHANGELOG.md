# Changelog

## [0.2.3] - 2026-10-21

### Added

- Resolve cross-connection references through matching integrations.
- Support polymorphic relation fields across collection targets.
- Resolve cross-scope relations with a shared reference codec.

### Fixed

- Diagnose unsupported Sanity schema semantics.

## [Unreleased]

### Changed

- Resolve named schema aliases and omit unresolved or ambiguous fields instead
  of widening them to strings; report unsupported validation and editor input
  behavior through plugin-side diagnostics without changing the push payload.
- Document the supported normalization subset and field-removal implications
  for authoritative schema pushes.

## [0.2.2] - 2026-09-11

### Changed

- Updated dependencies.

## [0.2.1] - 2026-09-09

### Changed

- Remove deprecated misspelled plugin aliases.

## [0.2.0] - 2026-09-08

### Changed

- **Breaking:** Removed the deprecated `UpdateConftuSchemaOptions` and
  `updateConftuSchema` typo aliases. Use `UpdateContfuSchemaOptions` and
  `updateContfuSchema` instead.
- Updated the bundled Sanity studio demo and tests to use the canonical
  `updateContfuSchema` helper.

## [0.1.8] - 2026-09-04

### Added

- Replace sync wire MessagePack with JSON.
- Model Sanity schemas as pushed with item-derived fallback.

## [0.1.7] - 2026-08-10

### Changed

- Updated dependencies.

## [0.1.6] - 2026-08-05

### Added

- Added plain-date and object property support.

### Fixed

- Correctly mapped direct Sanity object aliases to JSON.

## [0.1.5] - 2026-07-25

### Changed

- Upgraded TypeScript.

### Fixed

- Mapped Sanity object fields to JSON schema types.

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

- Added a correctly spelled Sanity schema sync helper.

### Changed

- Aligned Sanity CLI/setup docs with implemented project and dataset flags.

All notable changes to `@contfu/sanity` are documented here.

## [0.1.0] - 2026-06-09

### Changed

- Bumped package minor version.
