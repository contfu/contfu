# @contfu/core

Shared types, constants, query helpers, and rich-content utilities used across Contfu packages.

This package is a safe dependency for both browser and server environments. Import from the package root:

```ts
import { PropertyType, IntegrationType, renderBlocksMarkdown } from "@contfu/core";
```

## Public exports

- **`basic-auth`** — HTTP Basic auth helpers (`BasicAuthConfig`, `buildBasicAuthHeader`, `checkBasicAuth`, `unauthorizedBasicAuthResponse`).
- **`blocks`** — rich-content block and inline tuple types (`Block`, `BuiltInBlock`, `Component`, `Inline`, `ParagraphBlock`, `ImageBlock`, etc.) plus type guards and text helpers.
- **`collections`** — public collection shapes (`Collection`, `CollectionIcon`).
- **`colors`** — native `Color` type and conversion helpers for `0xRRGGBBAA`.
- **`commands`** — connector command types (`CommandType`, `Command`, `ConnectCommand`, `AckCommand`).
- **`enums`** — enum helper utilities (`defineEnum`, `defineStringEnum`, `EnumValue`).
- **`events`** — sync event constants and payload types (`EventType`, `ClientEventType`, `ItemEvent`, `SyncEvent`).
- **`filter-helpers`** — query filter builders (`eq`, `ne`, `gt`, `and`, `or`, `contains`, `linksTo`, `linkedFrom`) plus nested relation query builders (`all`, `oneOf`) and field-ref helpers (`createItemRef`, system field helpers, etc.).
- **`i18n`** — BCP 47 locale lists, localization config types, locale canonicalization, map normalization, and locale resolution helpers.
- **`integrations`** — integration types and capability helpers (`IntegrationType`, `IntegrationRole`, `IntegrationCapability`, `SyncMode`, `integrationSupportsContentProvide`, etc.).
- **`items`** — item payload types (`Item`, `PageProps`).
- **`markdown`** — rich-content Markdown renderers (`renderBlockMarkdown`, `renderBlocksMarkdown`, `renderInlineMarkdown`, custom renderer option types).
- **`mime`** — MIME type lookup table (`mimeTypes`).
- **`objects`** — structural object equality helper (`isObjectEqual`).
- **`query-types`** — query option/result helper types plus `normalizeQueryArgs`, `resolveQueryFilter`, and `QueryResultArray`.
- **`render`** — rich-content HTML renderers (`renderBlock`, `renderBlocks`, `renderInline`, `buildFileUrl`, custom renderer option types).
- **`schemas`** — schema contracts and type generation (`PropertyType`, `CollectionSchema`, `ComponentSchema`, `RefTargets`, `schemaType`, `schemaEnumValues`, `generateTypeScript`, `generateApplicationIntegrationTypes`, `generateConsumerTypes`).
- **`time`** — duration constants (`SECONDS`, `MINUTES`, `HOURS`, `DAYS`).
- **`wire`** — compact sync wire protocol tuples and patch helpers (`WireEvent`, `WireItem`, `WireItemPatch`, `diffWireItemPatch`, `materializeWireItemPatch`, `BatchEffectType`).

## Native Color values

`PropertyType.COLOR` fields are stored as a single unsigned 32-bit number in canonical `0xRRGGBBAA` order: red in the most significant byte, alpha in the least significant byte.

Use `Color` for generated TypeScript fields and the helpers in `colors` to convert at application boundaries:

- `colorFromRgba(r, g, b, a = 255)` / `colorToRgba(color)`
- `colorFromHex("#RRGGBB" | "#RRGGBBAA")` / `colorToHex(color)`
- `colorToCss(color)` for CSS-compatible `#RRGGBBAA`
- `asColor(value)` / `isColor(value)` for validating existing numeric values
