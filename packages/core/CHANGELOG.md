# Changelog

## [0.2.2] - 2026-07-25

### Added

- Added Directus integration support.
- Added application refresh command protocol support.
- Preserved Notion emoji page icons, creation timestamps, and rich-text spacing.

### Changed

- Documented the provider-neutral image block contract.
- Upgraded TypeScript.

### Fixed

- Normalized Contentful rich-text asset URLs.

## [0.2.1] - 2026-07-01

### Added

- Preserve deleted local items.
- Generate `FileMetadata` types for file fields.

## [0.2.0] - 2026-06-30

### Changed

- Breaking: changed query client file metadata results to return typed metadata.

## [0.1.1] - 2026-06-26

### Added

- Added shared receive pipeline support for Notion delivery.
- Added webhook integration and target schema delivery contracts.
- Added Strapi content receive capability.
- Added integration role and capability metadata.
- Added integration capability gating support.

### Changed

- Corrected public query docs and README export inventory.

### Fixed

- Implemented flat query options end-to-end.
- Exposed query result pagination metadata.
- Removed the stale `$integrationType` application query system field.
- Aligned generated rich-content/component TypeScript contracts with the runtime block model.

All notable changes to `@contfu/core` are documented here.

## [0.1.0] - 2026-06-09

### Changed

- Bumped package minor version.

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
