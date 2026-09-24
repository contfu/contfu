import { describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import { createDatabaseClient } from "../../infra/db/db";
import { setCollection } from "../collections/setCollection";
import { createOrUpdateItem } from "./createOrUpdateItem";
import { getItemById } from "./getItemById";
import { deleteItem } from "./deleteItem";
import { findItems } from "./findItems";
import { createItemLink } from "./createItemLink";
import { renameCollection } from "../collections/renameCollection";

describe("collection-scoped persistence", () => {
  test("native edits, references and deletions stay in their destination collection", async () => {
    const db = await createDatabaseClient(":memory:");
    setCollection("source", "Source", { original: PropertyType.STRING }, undefined, db);
    setCollection("target", "Target", { title: PropertyType.STRING }, undefined, db);
    createOrUpdateItem(
      { id: 30, collection: "source", changedAt: 1, props: { original: "Before" } },
      db,
    );
    createOrUpdateItem(
      { id: 30, collection: "target", changedAt: 1, props: { title: "Before" } },
      db,
    );
    createOrUpdateItem(
      { id: 30, collection: "target", changedAt: 2, props: { title: "Native edit" } },
      db,
    );
    expect(getItemById(["source", 30], undefined, db)).toMatchObject({
      $id: ["source", 30],
      original: "Before",
    });
    expect(getItemById(["target", 30], undefined, db)).toMatchObject({
      $id: ["target", 30],
      title: "Native edit",
    });
    expect(getItemById(["target", 30], undefined, db)).not.toHaveProperty("original");
    expect(findItems({ filter: '$id = ["target",30]' }, db)).toHaveLength(1);
    createItemLink({ prop: null, from: ["source", 30], to: ["target", 30] }, db);
    expect(findItems({ filter: 'linksTo() = ["target",30]' }, db).map((item) => item.$id)).toEqual([
      ["source", 30],
    ]);
    expect(getItemById(["source", 30], { include: ["links"] }, db)?.links).toEqual([
      expect.objectContaining({ $id: ["target", 30], title: "Native edit" }),
    ]);
    deleteItem(["target", 30], db);
    expect(getItemById(["target", 30], undefined, db)).toBeNull();
    expect(getItemById(["source", 30], undefined, db)).not.toBeNull();
  });

  test("collection renames cascade the canonical identity to outgoing links", async () => {
    const db = await createDatabaseClient(":memory:");
    setCollection("old", "Old", {}, undefined, db);
    setCollection("other", "Other", {}, undefined, db);
    createOrUpdateItem({ id: 1, collection: "old", changedAt: 1, props: {} }, db);
    createOrUpdateItem({ id: 1, collection: "other", changedAt: 1, props: {} }, db);
    createItemLink({ prop: null, from: ["old", 1], to: ["other", 1] }, db);
    renameCollection("old", "new", "New", db);
    expect(getItemById(["new", 1], { include: ["links"] }, db)?.links).toEqual([
      expect.objectContaining({ $id: ["other", 1] }),
    ]);
  });
});
