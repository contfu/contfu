# @contfu/core

Shared types and constants used across all Contfu packages.

## Contents

- **`blocks`** — rich-text block and inline types (`Block`, `Inline`, `ParagraphBlock`, `ImageBlock`, etc.)
- **`schemas`** — `PropertyType` enum, `CollectionSchema`, `SchemaValue`
- **`collections`** — `CollectionType`, `ConnectionType` enums
- **`items`** — `ItemStatus`, `EventType` enums
- **`commands`** — `CommandType` enum
- **`events`** — event shape types for the sync stream
- **`mime`** — MIME type utilities

This package contains no runtime logic — only types and constants. It is a safe dependency for both browser and server environments.
