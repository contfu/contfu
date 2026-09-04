# Changelog

## [0.2.1] - 2026-09-04

### Added

- Migrate the Strapi plugin to generic sequenced pushes.
- Add Web webhook source pushes.
- Add signed generic Contfu item push ingestion.

### Changed

- Remove obsolete integration-specific webhook ingress routes.

## [0.2.0] - 2026-08-08

### Changed

- Send plugin lifecycle pushes and the enabled handshake through the generic
  `/webhooks/contfu/{uid}` endpoint using `@contfu/webhook`.
- Add a durable integration-scoped sequence to every lifecycle push for gap
  detection. Configure the generic endpoint before deploying this breaking release.
- The old `/webhooks/strapi/{uid}` ingress is retired; all plugin pushes use the generic route and headers.

## [0.1.2] - 2026-08-07

### Added

- Added the Contfu plugin description to Strapi.

## [0.1.1] - 2026-06-26

### Fixed

- Fixed package exports so the installed plugin is loadable from the package root.

All notable changes to `@contfu/strapi` are documented here.

## [0.1.0] - 2026-06-09

### Changed

- Bumped package minor version.
