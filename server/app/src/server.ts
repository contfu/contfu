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
              source.pull(col, since).pipe(map((item) => ({ id: c.id, item })))
            ),
            ...Object.keys(c.collections).map((col) =>
              source
                .pullCollectionRefs(col)
                .pipe(map((refs) => ({ id: c.id, refs })))
            )
          );
        })
      ).subscribe((data) => {
        ws.send(JSON.stringify(data));
      })
    );
    state.set(ws.id, { conns: sources.map((c) => c.key), sub });
  },
  open(ws) {
    console.log("New connection", ws.id);
  },
  close(ws) {
    console.log("Connection closed", ws.id);
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
