import { ChangedEvent, EventType, ItemEvent, ListIdsEvent } from "@contfu/core";
import Elysia, { t } from "elysia";
import { Subscription, map, merge } from "rxjs";
import { authenticate } from "./access/access-store";
import { SourceSchema, buildSource } from "./sources/source-schema";

export const app = new Elysia().ws("/pages", {
  body: t.Object({
    sources: t.Array(SourceSchema),
    since: t.Optional(t.Number()),
  }),
  message(ws, { sources, since }) {
    for (const c of sources) {
      if (!authenticate(c.key)) {
        ws.send(JSON.stringify({ error: "E_AUTH", idx: sources.indexOf(c) }));
        return;
      }
      if (activeSources.has(c.key)) {
        ws.send(
          JSON.stringify({ error: "E_CONFLICT", idx: sources.indexOf(c) })
        );
        return;
      }
    }
    const sub = new Subscription();
    sub.add(
      merge(
        ...sources.map((src) => {
          activeSources.add(src.key);
          const source = buildSource(src);
          return merge(
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
                      src: src.id,
                      type: EventType.LIST_IDS,
                      collection: col.id,
                      items: ids,
                    } satisfies ListIdsEvent)
                )
              )
            )
          );
        })
      ).subscribe((data: ItemEvent) => {
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
            return ws.send(buf);
          }
          case EventType.LIST_IDS: {
            const ids = data.items;
            const buf = Buffer.alloc(4 + ids.length * 16);
            buf.writeUInt8(data.type, 0);
            buf.writeUInt8(data.src, 1);
            buf.writeUInt16LE(data.collection, 2);
            for (let i = 0; i < ids.length; i++)
              buf.write(ids[i], 4 + i * 16, "base64url");
            return ws.send(buf);
          }
          case EventType.DELETED: {
            const bufferLength = 4 + data.item.length;
            const buf = Buffer.alloc(bufferLength);
            buf.writeUInt8(data.type, 0);
            buf.writeUInt8(data.src, 1);
            buf.writeUInt16LE(data.collection, 2);
            buf.write(data.item, 4, "base64url");
            return ws.send(buf);
          }
        }
      })
    );
    state.set(ws.id, { conns: sources.map((c) => c.key), sub });
  },
  close(ws) {
    const s = state.get(ws.id);
    if (!s) return;
    s.sub.unsubscribe();
    for (const c of s.conns) {
      activeSources.delete(c);
    }
  },
});

const state = new Map<string, { conns: string[]; sub: Subscription }>();
const activeSources = new Set<string>();
