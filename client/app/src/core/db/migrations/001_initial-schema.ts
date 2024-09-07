import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("page")
    .addColumn("id", "blob", (col) => col.primaryKey())
    .addColumn("path", "text", (col) => col.unique().notNull())
    .addColumn("collection", "text")
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("content", "text")
    .addColumn("props", "text")
    .addColumn("author", "text")
    .addColumn("connection", "integer", (col) => col.notNull())
    .addColumn("publishedAt", "integer", (col) => col.notNull())
    .addColumn("createdAt", "integer", (col) => col.notNull())
    .addColumn("updatedAt", "integer")
    .addColumn("changedAt", "integer", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("page_collection_idx")
    .on("page")
    .column("collection")
    .execute();

  await db.schema
    .createIndex("page_published_at_idx")
    .on("page")
    .column("publishedAt")
    .execute();

  await db.schema
    .createIndex("page_changed_at_idx")
    .on("page")
    .column("changedAt")
    .execute();

  await db.schema
    .createTable("pageLink")
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("from", "blob", (col) =>
      col.references("page.id").onDelete("cascade").notNull()
    )
    .addColumn("to", "blob", (col) =>
      col.references("page.id").onDelete("cascade").notNull()
    )
    .addPrimaryKeyConstraint("pageLink_pk", ["type", "from", "to"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("pageLink").execute();
  await db.schema.dropTable("page").cascade().execute();
}
