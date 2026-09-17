// Separate process: the runtime uses SQLite while the service uses PostgreSQL.
// Exercise the real connector and runtime transaction, not extractLinks in isolation.
import { connect } from "../src/connect";
import { db } from "../src/infra/db/db";
import { internalLinkTable, itemsTable } from "../src/infra/db/schema";
import { EventType } from "@contfu/core";

const origin = process.env.CONTFU_INTERNAL_CLOUD_URL!;
for await (const event of connect({
  key: Buffer.alloc(32, 1),
  reconnect: false,
  localFiles: false,
})) {
  if (event.type === EventType.COLLECTION_SCHEMA && !("related" in event.schema)) {
    await fetch(`${origin}/ready`, { method: "POST" });
  }
  if (event.type === EventType.ITEM_CHANGED && event.item.id === 123) {
    await fetch(`${origin}/result`, {
      method: "POST",
      body: JSON.stringify({
        items: db.select().from(itemsTable).all(),
        links: db.select().from(internalLinkTable).all(),
      }),
    });
    break;
  }
}
