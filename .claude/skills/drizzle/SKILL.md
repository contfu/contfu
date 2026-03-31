---
name: drizzle
description: Drizzle ORM patterns for schemas and queries in Contfu and related projects. Use when defining tables, writing queries with subqueries/filters, setting up foreign keys, or working with timestamps, blobs, and composite keys. Always prefer type-safe Drizzle operators over raw SQL.
model: sonnet
---

# Drizzle Patterns

This skill documents the Drizzle ORM conventions used in Contfu (and applicable to Pumpit). Follow these patterns for consistency.

## Quick Reference

```typescript
import { sql } from "drizzle-orm";
import { blob, foreignKey, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
```

## Core Patterns

### 1. Timestamps

Store as Unix epoch (seconds) using integer columns:

```typescript
// Created timestamp — auto-set via SQL default
createdAt: integer({ mode: "timestamp" })
  .default(sql`(unixepoch())`)
  .notNull(),

// Updated timestamp — nullable, set manually on updates
updatedAt: integer({ mode: "timestamp" }),
```

**Why integer over datetime?**

- SQLite has no native datetime type
- Unix timestamps are smaller and faster to compare
- `unixepoch()` is SQLite's built-in function

### 2. Primary Keys

**Simple auto-increment:**

```typescript
id: integer().primaryKey({ autoIncrement: true }),
```

**Composite keys for multi-tenant data:**

```typescript
export const sourceTable = sqliteTable(
  "source",
  {
    userId: text().notNull(),
    id: integer().notNull(),
    // ... other columns
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);
```

**When to use composite keys:**

- Multi-tenant tables where `userId` scopes all data
- Junction tables linking two entities
- Tables with natural compound identifiers

### 3. Foreign Keys

**Simple FK with cascade:**

```typescript
userId: integer()
  .notNull()
  .references(() => userTable.id, { onDelete: "cascade" }),
```

**Composite FK (for multi-tenant tables):**

```typescript
export const collectionTable = sqliteTable(
  "collection",
  {
    userId: text().notNull(),
    sourceId: integer().notNull(),
    id: integer().notNull(),
    // ...
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    foreignKey({
      columns: [table.userId, table.sourceId],
      foreignColumns: [sourceTable.userId, sourceTable.id],
    }).onDelete("cascade"),
  ],
);
```

**Delete behaviors:**

- `cascade` — Delete child rows when parent deleted (most common)
- `set null` — Set FK to null (for optional relationships)
- `restrict` — Prevent deletion if children exist

### 4. Blob Mode for Binary Data

Use `blob({ mode: "buffer" })` for:

- Encrypted credentials
- Binary identifiers (UUIDs, hashes)
- Packed binary data

```typescript
// Encrypted data
credentials: blob({ mode: "buffer" }),

// Binary reference ID from external source
ref: blob({ mode: "buffer" }),

// Packed array of item IDs
itemIds: blob({ mode: "buffer" }),
```

**Why buffer mode?**

- Returns `Buffer` in Node.js/Bun
- Efficient for binary operations
- Works with encryption libraries directly

### 5. Type Inference

Always export types for select and insert:

```typescript
export const userTable = sqliteTable("user", {
  id: integer().primaryKey(),
  name: text().notNull(),
  email: text().unique().notNull(),
});

export type User = typeof userTable.$inferSelect;
export type CreateUser = typeof userTable.$inferInsert;
```

### 6. Indexes

Add indexes for frequently queried columns:

```typescript
import { index } from "drizzle-orm/sqlite-core";

export const webhookLogTable = sqliteTable(
  "webhook_log",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text().notNull(),
    sourceId: integer().notNull(),
    timestamp: integer().notNull(),
    // ...
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.sourceId],
      foreignColumns: [sourceTable.userId, sourceTable.id],
    }).onDelete("cascade"),
    // Index for time-based queries
    index("webhook_log_timestamp_idx").on(table.timestamp),
  ],
);
```

### 7. Unique Constraints

```typescript
import { unique } from "drizzle-orm/sqlite-core";

export const paramTable = sqliteTable(
  "param",
  {
    id: integer().primaryKey(),
    schemaId: integer().notNull(),
    name: integer().notNull(),
    // ...
  },
  (table) => [unique("param_schema_name_unique").on(table.schemaId, table.name)],
);
```

### 8. Boolean Columns

SQLite has no boolean type. Use integer with mode:

```typescript
emailVerified: integer({ mode: "boolean" }).notNull().default(false),
enabled: integer({ mode: "boolean" }).notNull().default(true),
```

### 9. Enums via Type Casting

Store as integer, cast to TypeScript enum:

```typescript
import { WorkflowAccessRight } from "./types";

right: integer().$type<WorkflowAccessRight>().notNull(),
```

### 10. Custom Types (Advanced)

For special serialization (e.g., bigint to blob):

```typescript
import { customType } from "drizzle-orm/sqlite-core";

export const bigint = customType<{ data: bigint; driverData: Uint8Array }>({
  dataType() {
    return "blob";
  },
  toDriver(value) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(value);
    return buf;
  },
  fromDriver(value) {
    return Buffer.from(value).readBigUInt64BE(0);
  },
});

// Usage
hash: bigint().unique().notNull(),
```

## Schema Organization

### File Structure

```
packages/
├── service/app/src/lib/server/db/
│   ├── schema.ts       # Main schema definitions
│   └── db.ts           # Database connection + Drizzle instance
└── backend/src/infra/db/db/
    ├── schema.ts       # Schema definitions
    └── drizzle-cols-and-types.ts  # Reusable column helpers
```

### Reusable Column Helpers

Create helpers for commonly repeated patterns:

```typescript
// drizzle-cols-and-types.ts
import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

export const createdAt = integer()
  .default(sql`(unixepoch())`)
  .notNull();

export const updatedAt = integer();

// Usage in schema:
import { createdAt, updatedAt } from "./drizzle-cols-and-types";

export const workflow = sqliteTable("workflow", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  createdAt,
  updatedAt,
});
```

## Migration Workflow

```bash
# Generate migration from schema changes
bun run db:generate

# Run migrations
bun run db:migrate

# Open Drizzle Studio for debugging
bun run db:studio
```

## Common Patterns

### Multi-Tenant Table Template

```typescript
export const resourceTable = sqliteTable(
  "resource",
  {
    // Tenant scope
    userId: text()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    // Local ID (unique within tenant)
    id: integer().notNull(),
    // Business fields
    name: text().notNull(),
    data: blob({ mode: "buffer" }),
    // Timestamps
    createdAt: integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer({ mode: "timestamp" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export type Resource = typeof resourceTable.$inferSelect;
```

### Junction Table Template

```typescript
export const userRoleTable = sqliteTable(
  "user_role",
  {
    userId: integer()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    roleId: integer()
      .notNull()
      .references(() => roleTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);
```

### Audit Log Template

```typescript
export const auditLogTable = sqliteTable(
  "audit_log",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text()
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    action: text().notNull(),
    resourceType: text().notNull(),
    resourceId: text().notNull(),
    metadata: blob({ mode: "buffer" }),
    timestamp: integer({ mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (table) => [
    index("audit_log_user_idx").on(table.userId),
    index("audit_log_timestamp_idx").on(table.timestamp),
  ],
);
```

## Query Patterns

### Subqueries with notInArray / inArray

Use Drizzle's type-safe operators instead of raw `sql` template strings:

```typescript
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";

// Keep only the newest N rows — delete the rest
const keepIds = db
  .select({ id: logTable.id })
  .from(logTable)
  .where(eq(logTable.connectionId, connectionId))
  .orderBy(desc(logTable.timestamp))
  .limit(MAX_LOGS);

await db
  .delete(logTable)
  .where(and(eq(logTable.connectionId, connectionId), notInArray(logTable.id, keepIds)));
```

Drizzle query builders are `SQLWrapper` instances — they can be passed directly to `inArray()` / `notInArray()` as subqueries. This generates a single `DELETE ... WHERE id NOT IN (SELECT ...)` statement.

### Filtering with exists / notExists

```typescript
import { exists, notExists } from "drizzle-orm";

// Select users who have at least one connection
const usersWithConnections = await db
  .select()
  .from(userTable)
  .where(exists(db.select().from(connectionTable).where(eq(connectionTable.userId, userTable.id))));
```

## Anti-Patterns to Avoid

❌ **Don't use raw SQL when Drizzle has a type-safe equivalent:**

```typescript
// Bad — raw sql template loses type safety
await db
  .delete(logTable)
  .where(sql`${logTable.id} not in (select ${logTable.id} from ${logTable} ...)`);

// Good — Drizzle subquery, fully typed
const keepIds = db
  .select({ id: logTable.id })
  .from(logTable)
  .orderBy(desc(logTable.timestamp))
  .limit(50);
await db.delete(logTable).where(notInArray(logTable.id, keepIds));
```

Reserve `sql` for schema defaults (`sql\`(unixepoch())\``) and expressions that Drizzle genuinely cannot represent. For filtering, ordering, joins, and subqueries — use the query builder.

❌ **Don't use text for timestamps:**

```typescript
// Bad
createdAt: text().default(sql`(datetime('now'))`),
```

❌ **Don't forget cascade on tenant FKs:**

```typescript
// Bad - orphaned data when user deleted
userId: text().references(() => userTable.id),
```

❌ **Don't mix ID types:**

```typescript
// Bad - some tables use text IDs, others use integer
id: text().primaryKey(), // In one table
id: integer().primaryKey(), // In another
```

## See Also

- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [SQLite Datatypes](https://www.sqlite.org/datatype3.html)
- `contfu-development` — General development workflow
- `contfu-source-adapter` — How adapters use these schemas
