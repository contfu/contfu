import { ChangedEvent, EventType, ItemEvent, ListIdsEvent } from "@contfu/core";
import Elysia, { t } from "elysia";
import { Subscription, map, merge } from "rxjs";
import { authenticate } from "./access/db/access-datasource";
import { SourceSchema, buildSource } from "./sources/source";

export const app = new Elysia()
  .get("/", () => "This will be awesome!")
  .ws("/pages", {
    body: t.Object({
      sources: t.Array(SourceSchema),
      since: t.Optional(t.Number()),
    }),
    async message(ws, { sources, since }) {
      for (const src of sources) {
        if (!(await authenticate(Buffer.from(src.key, "base64url")))) {
          ws.send(
            JSON.stringify({ error: "E_AUTH", idx: sources.indexOf(src) })
          );
          continue;
        }
        if (subs.has(src.key)) {
          ws.send(
            JSON.stringify({ error: "E_CONFLICT", idx: sources.indexOf(src) })
          );
          continue;
        }
        const keys = socketKeys.get(ws.id) ?? [];
        keys.push(src.key);
        socketKeys.set(ws.id, keys);
        const source = buildSource(src);
        subs.set(
          src.key,
          merge(
            ...src.collections.map((col) =>
              source.pull(col, since).pipe(
                map(
                  (item) =>
                    ({
                      type: EventType.CHANGED,
                      src: src.id,
                      collection: col.id,
                      item,
                    } satisfies ChangedEvent)
                )
              )
            ),
            ...src.collections.map((col) =>
              source.pullCollectionIds(col).pipe(
                map(
                  (ids) =>
                    ({
                      type: EventType.LIST_IDS,
                      src: src.id,
                      collection: col.id,
                      ids,
                    } satisfies ListIdsEvent)
                )
              )
            )
          ).subscribe((data: ItemEvent) => {
            ws.send(serializeEvent(data));
          })
        );
      }
    },
    close(ws) {
      const keys = socketKeys.get(ws.id);
      if (!keys) return;
      for (const key of keys) {
        subs.get(key)!.unsubscribe();
        subs.delete(key);
      }
      socketKeys.delete(ws.id);
    },
  });

const subs = new Map<string, Subscription>();
const socketKeys = new Map<string, string[]>();

function serializeEvent(data: ItemEvent) {
  switch (data.type) {
    case EventType.CHANGED: {
      const { item } = data;
      const dynamicData = Buffer.from(JSON.stringify(item.props));
      const buf = Buffer.alloc(36 + dynamicData.length);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt8(item.src, 1);
      buf.writeUInt16LE(item.collection, 2);
      buf.write(item.id, 4, "base64url");
      buf.writeBigInt64LE(BigInt(item.createdAt), 20);
      buf.writeBigInt64LE(BigInt(item.changedAt), 28);
      dynamicData.copy(buf, 36);
      return buf;
    }
    case EventType.LIST_IDS: {
      const ids = data.ids;
      const buf = Buffer.alloc(4 + ids.length * 16);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt8(data.src, 1);
      buf.writeUInt16LE(data.collection, 2);
      for (let i = 0; i < ids.length; i++)
        buf.write(ids[i], 4 + i * 16, "base64url");
      return buf;
    }
    case EventType.DELETED: {
      const bufferLength = 4 + data.item.length;
      const buf = Buffer.alloc(bufferLength);
      buf.writeUInt8(data.type, 0);
      buf.writeUInt8(data.src, 1);
      buf.writeUInt16LE(data.collection, 2);
      buf.write(data.item, 4, "base64url");
      return buf;
    }
  }
}
