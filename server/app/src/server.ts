import Elysia, { t } from "elysia";
import { Subscription, map, merge } from "rxjs";
import { authenticate } from "./access/access-store";
import {
  ConnectionSchema,
  buildConnection,
} from "./connection/connection-schema";

const app = new Elysia()
  .ws("/pages", {
    body: t.Object({
      connections: t.Array(ConnectionSchema),
      since: t.Optional(t.Number()),
    }),
    message(ws, { connections, since }) {
      for (const c of connections) {
        console.log("Connection", c.type);
        if (!authenticate(c.key)) {
          ws.send(
            JSON.stringify({ error: "E_AUTH", idx: connections.indexOf(c) })
          );
          return;
        }
        if (activeConnections.has(c.key)) {
          ws.send(
            JSON.stringify({ error: "E_CONFLICT", idx: connections.indexOf(c) })
          );
          return;
        }
      }
      const sub = new Subscription();
      sub.add(
        merge(
          ...connections.map((c, i) => {
            activeConnections.add(c.key);
            const connection = buildConnection(c);
            return merge(
              ...Object.keys(c.collections).map((col) =>
                connection.pull(col).pipe(map((page) => ({ id: c.id, page })))
              ),
              ...Object.keys(c.collections).map((col) =>
                connection
                  .pullCollectionRefs(col)
                  .pipe(map((refs) => ({ id: c.id, refs })))
              )
            );
          })
        ).subscribe((data) => {
          ws.send(JSON.stringify(data));
        })
      );
      state.set(ws.id, { conns: connections.map((c) => c.key), sub });
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
        activeConnections.delete(c);
      }
    },
  })
  .listen(3000);

const state = new Map<string, { conns: string[]; sub: Subscription }>();
const activeConnections = new Set<string>();
