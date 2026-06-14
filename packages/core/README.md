# @contfu/core

Shared types and constants used across all Contfu packages.

## Contents

- **`blocks`** — rich-text block and inline types (`Block`, `Inline`, `ParagraphBlock`, `ImageBlock`, etc.)
- **`schemas`** — `PropertyType` enum, `CollectionSchema`, `SchemaValue`
- **`colors`** — native `Color` type and conversion helpers for `0xRRGGBBAA`
- **`collections`** — `CollectionType`, `IntegrationType` enums
- **`items`** — `ItemStatus`, `EventType` enums
- **`commands`** — `CommandType` enum
- **`events`** — event shape types for the sync stream
- **`mime`** — MIME type utilities

## Native Color values

`PropertyType.COLOR` fields are stored as a single unsigned 32-bit number in canonical `0xRRGGBBAA` order: red in the most significant byte, alpha in the least significant byte.

Use `Color` for generated TypeScript fields and the helpers in `colors` to convert at application boundaries:

- `colorFromRgba(r, g, b, a = 255)` / `colorToRgba(color)`
- `colorFromHex("#RRGGBB" | "#RRGGBBAA")` / `colorToHex(color)`
- `colorToCss(color)` for CSS-compatible `#RRGGBBAA`
- `asColor(value)` / `isColor(value)` for validating existing numeric values

This package is a safe dependency for both browser and server environments.
