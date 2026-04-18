# Changelog

All notable changes to `@contfu/core` are documented here.

## [0.0.10] - 2026-04-18

### Added

- `renderInlineMarkdown` and `renderBlockMarkdown` — convert block/inline trees to Markdown strings
- `render()` — generic block renderer utility for custom output formats
- Expanded schema helpers and type definitions

### Changed

- Query API filter operators (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `notLike`, `contains`) are now type-safe: the value argument is constrained to the field's declared type

## [0.0.9] - 2026-04-16

### Changed

- Updated dependencies

## [0.0.8] - 2026-04-14

Initial public release.
