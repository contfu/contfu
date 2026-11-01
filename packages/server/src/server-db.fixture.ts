import assert from "node:assert/strict";
import { ClientEventType, EventType, PropertyType } from "@contfu/core";
import { createDatabaseClient, getSyncIndex, withDatabase } from "@contfu/contfu";
import { createServeOptions } from "./server";

const ready = Promise.withResolvers<MockSyncWebSocket>();
const acknowledged = Promise.withResolvers<void>();

class MockSyncWebSocket {
  static readonly OPEN = 1;
  readyState = MockSyncWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  private messageHandler: ((event: { data: string }) => void) | null = null;

  constructor() {
    queueMicrotask(() => this.onopen?.());
  }

  set onmessage(handler: ((event: { data: string }) => void) | null) {
    this.messageHandler = handler;
    if (handler) ready.resolve(this);
  }

  get onmessage() {
    return this.messageHandler;
  }

  send(message: string) {
    if (JSON.parse(message)[0] === ClientEventType.ACK) acknowledged.resolve();
  }
  close(code = 1000, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

try {
  globalThis.WebSocket = MockSyncWebSocket as unknown as typeof WebSocket;
  const databasePath = process.argv[2]!;
  const defaultIndex = getSyncIndex();
  const options = createServeOptions({ db: databasePath });
  const socket = await ready.promise;
  socket.onmessage!({
    data: JSON.stringify([
      [
        EventType.COLLECTION_SCHEMA,
        "articles",
        "Articles",
        { author: PropertyType.REF, related: PropertyType.REFS },
        null,
        "articles-schema",
        987_653,
        { author: ["authors"], related: ["articles", "authors"] },
      ],
      [EventType.ITEM_DELETED, ["articles", 1], 987_654],
    ]),
  });
  // ACK follows persistence of the entire batch, not just socket installation.
  await acknowledged.promise;
  const configured = await createDatabaseClient(databasePath);
  assert.equal(
    withDatabase(configured, () => getSyncIndex()),
    987_654,
  );
  assert.equal(getSyncIndex(), defaultIndex);

  const handler = options.routes!["/api/types"] as (request: Request) => Promise<Response>;
  const response = await handler(new Request("http://localhost/api/types"));
  assert.equal(response.status, 200);
  const types = await response.text();
  assert.ok(types.includes("author: [collection: string, id: number] | string;"));
  assert.ok(
    types.includes(
      'related: (ContfuCollections["articles"] | [collection: string, id: number] | string)[];',
    ),
  );
  socket.close();
  // The SDK hot consumer is process-scoped. Exiting owns its timers, media worker,
  // database handles and reconnect loop without leaving them in the test runner.
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
