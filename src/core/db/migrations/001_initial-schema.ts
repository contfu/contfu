import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("connection")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("key", "text", (col) => col.notNull())
    .addColumn("target", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("createdAt", "integer", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  await db.schema
    .createTable("page")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("ref", "text", (col) => col.unique().notNull())
    .addColumn("slug", "text", (col) => col.unique().notNull())
    .addColumn("type", "text")
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("attributes", "text", (col) => col.notNull())
    .addColumn("author", "text")
    .addColumn("connection", "integer", (col) =>
      col.references("connection.id").notNull()
    )
    .addColumn("publishedAt", "integer", (col) => col.notNull())
    .addColumn("createdAt", "integer", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updatedAt", "integer")
    .addColumn("changedAt", "integer", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  await db.schema
    .createIndex("page_type_idx")
    .on("page")
    .column("type")
    .execute();

  await db.schema
    .createIndex("page_published_at_idx")
    .on("page")
    .column("publishedAt")
    .execute();

  await db.schema
    .createTable("pageLink")
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("from", "integer", (col) => col.references("page.id").notNull())
    .addColumn("to", "integer", (col) => col.references("page.id").notNull())
    .execute();

  await db.schema
    .createTable("component")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("ref", "text", (col) => col.unique().notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("props", "text", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("changedAt", "integer", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("createdAt", "integer", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  await db.schema
    .createIndex("component_name_idx")
    .on("component")
    .column("name")
    .execute();

  await db.schema
    .createTable("pageComponent")
    .addColumn("pageId", "integer", (col) =>
      col.notNull().references("page.id")
    )
    .addColumn("componentId", "integer", (col) =>
      col.notNull().references("component.id")
    )
    .addPrimaryKeyConstraint("pageComponentPrimaryKey", [
      "pageId",
      "componentId",
    ])
    .execute();

  await db.schema
    .createTable("componentRelation")
    .addColumn("parentId", "integer", (col) =>
      col.notNull().references("component.id")
    )
    .addColumn("childId", "integer", (col) =>
      col.notNull().references("component.id")
    )
    .addPrimaryKeyConstraint("componentRelationPrimaryKey", [
      "parentId",
      "childId",
    ])
    .execute();

  await db.schema
    .createTable("sync")
    .addColumn("connection", "integer", (col) =>
      col.references("connection.id").notNull()
    )
    .addColumn("full", "integer")
    .addColumn("changes", "integer")
    .addColumn("orphans", "integer")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("sync").execute();
  await db.schema.dropTable("person").execute();
}
