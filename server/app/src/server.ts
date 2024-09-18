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
        ...sources.map((c) => {
          activeSources.add(c.key);
          const source = buildSource(c);
          return merge(
            ...Object.keys(c.collections).map((col) =>
              source.pull(col, since).pipe(
                map(
                  (item) =>
                    ({
                      type: EventType.CHANGED,
                      item,
                    } satisfies ChangedEvent)
                )
              )
            ),
            ...Object.keys(c.collections).map((col) =>
              source.pullCollectionIds(col).pipe(
                map(
                  (ids) =>
                    ({
                      id: c.id,
                      type: EventType.LIST_IDS,
                      collection: col,
                      itemIds: ids,
                    } satisfies ListIdsEvent)
                )
              )
            )
          );
        })
      ).subscribe((data: ItemEvent) => {
        const type = Buffer.from([data.type]);

        if (data.type === EventType.CHANGED) {
          const { item } = data;
          const dynamicData = Buffer.from(
            `${item.collection}\u001C${JSON.stringify(item.props)}`
          );
          const buf = Buffer.alloc(49 + dynamicData.length);
          buf.writeUInt8(data.type, 0);
          buf.write(item.src, 1, "hex");
          buf.write(item.id, 17, "hex");
          buf.writeBigInt64BE(BigInt(item.createdAt), 33);
          buf.writeBigInt64BE(BigInt(item.changedAt), 41);
          dynamicData.copy(buf, 49);
          return ws.send(buf);
        }
        const collection = data.collection;
        if (data.type === EventType.LIST_IDS) {
          const ids = data.itemIds;
          const buf = Buffer.alloc(19 + collection.length + ids.length * 16);
          buf.writeUInt8(data.type, 0);
          buf.write(data.id, 1, "hex");
          buf.writeUInt16BE(collection.length, 17);
          buf.write(collection, 19);
          for (let i = 0; i < ids.length; i++)
            buf.write(ids[i], 19 + collection.length + i * 16, "hex");
          return ws.send(buf);
        }
        if (data.type === EventType.DELETED) {
          const buf = Buffer.alloc(33 + collection.length);
          buf.writeUInt8(data.type);
          buf.write(data.id, 1, "hex");
          buf.write(data.itemId, 17, "hex");
          buf.write(collection, 19);
          return ws.send(buf);
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
