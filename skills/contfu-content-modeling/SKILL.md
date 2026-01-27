---
name: contfu-content-modeling
description: Design content schemas and collection mappings for Contfu. Use when modeling content types, defining property schemas, mapping CMS fields to Contfu properties, planning collection structures, or designing relationships between content items.
---

# Contfu Content Modeling

Design effective content schemas for syncing CMS content.

## Core Concepts

### Collections

A **Collection** maps to a content type in the upstream CMS:
- Notion: Database
- Strapi: Content Type
- Contentful: Content Type
- Sanity: Document Type

### Items

An **Item** is a single content entry with:
- `id` — Unique Contfu identifier (generated)
- `ref` — Original CMS identifier (Buffer)
- `collection` — Collection ID
- `createdAt` / `changedAt` — Timestamps (ms)
- `props` — Structured properties (key-value)
- `content` — Rich content blocks (optional)

### Properties vs Content

| Use Properties For | Use Content For |
|-------------------|-----------------|
| Metadata (title, slug, date) | Long-form text |
| Taxonomy (categories, tags) | Rich text with formatting |
| Settings (published, featured) | Nested structures |
| References (author, related) | Mixed media blocks |
| Media URLs (thumbnail, cover) | Tables, code blocks |

## Property Types

```typescript
type PropertyValue =
  | string           // Text, URL, email
  | number           // Numbers, timestamps
  | boolean          // Checkboxes
  | string[]         // Multi-select, tags
  | number[]         // Number arrays
  | Buffer[]         // Relations (item refs)
```

## Schema Definition

```typescript
interface CollectionSchema {
  properties: {
    [key: string]: {
      type: "string" | "number" | "boolean" | "string[]" | "number[]" | "ref[]";
      required?: boolean;
    };
  };
}
```

## Content Block Types

```typescript
type ContentBlock =
  | { type: "paragraph"; content: RichText[] }
  | { type: "heading_1" | "heading_2" | "heading_3"; content: RichText[] }
  | { type: "bulleted_list_item"; content: RichText[]; children?: ContentBlock[] }
  | { type: "numbered_list_item"; content: RichText[]; children?: ContentBlock[] }
  | { type: "code"; content: RichText[]; language?: string }
  | { type: "quote"; content: RichText[] }
  | { type: "callout"; content: RichText[]; icon?: string }
  | { type: "image"; url: string; caption?: RichText[] }
  | { type: "video"; url: string }
  | { type: "file"; url: string; name?: string }
  | { type: "divider" }
  | { type: "table"; rows: TableRow[] }
  | { type: "toggle"; content: RichText[]; children?: ContentBlock[] }

type RichText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  link?: string;
  color?: string;
};
```

## Modeling Patterns

### Blog Posts

```typescript
// Properties
{
  title: string,
  slug: string,
  excerpt: string,
  publishedAt: number,      // timestamp
  author: Buffer[],         // relation to authors
  categories: string[],     // multi-select
  tags: string[],           // multi-select
  featured: boolean,
  cover: string,            // image URL
}
// Content: Rich text body with headings, images, code blocks
```

### Products

```typescript
// Properties
{
  name: string,
  sku: string,
  price: number,
  currency: string,
  stock: number,
  categories: Buffer[],     // relation to categories
  images: string[],         // file URLs
  published: boolean,
}
// Content: Product description with features, specs table
```

### Documentation Pages

```typescript
// Properties
{
  title: string,
  slug: string,
  section: string,          // select
  order: number,
  parent: Buffer[],         // relation (tree structure)
  lastUpdated: number,
}
// Content: Markdown-like content with code blocks, callouts
```

## Relationship Modeling

### One-to-Many (Author → Posts)

```typescript
// Author collection
{ name: string, bio: string, avatar: string }

// Post collection
{ author: Buffer[] }  // Single-item array references author
```

### Many-to-Many (Posts ↔ Tags)

```typescript
// Tag collection
{ name: string, slug: string }

// Post collection
{ tags: Buffer[] }  // Array references multiple tags
```

### Self-Referential (Page → Parent)

```typescript
// Page collection
{ 
  title: string,
  parent: Buffer[],   // Reference to another page
  order: number,      // Sort within parent
}
```

## Migration Checklist

When mapping from an existing CMS:

1. **Inventory content types** — List all content types/databases
2. **Map fields to properties** — Choose appropriate Contfu types
3. **Identify rich content** — Decide what goes in `content` blocks
4. **Model relationships** — Plan `Buffer[]` references
5. **Handle media** — Decide on URL storage vs optimization
6. **Plan incremental sync** — Use `since` cursor for timestamps
