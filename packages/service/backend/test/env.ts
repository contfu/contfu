import { mock } from "bun:test";

// Set PGLITE_DATA_DIR to trigger PGLite in db.ts (empty path = in-memory).
// We use PGLITE_DATA_DIR instead of NODE_ENV because Vite inlines process.env.NODE_ENV.
process.env.PGLITE_DATA_DIR = ":memory:";

// Mock NATS infrastructure so tests run without a live NATS server.
// All KV operations are no-ops; all JetStream operations are no-ops.
// Quota reads fall back to the DB (getQuotaFromKv returns null → getQuotaFromDb).

const noopKv = {
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(0),
  create: () => Promise.resolve(0),
  update: () => Promise.resolve(0),
  delete: () => Promise.resolve(),
  watch: () => Promise.resolve((async function* () {})()),
};

const noopKvm = {
  create: () => Promise.resolve(noopKv),
};

const noopStream = {
  getConsumer: () =>
    Promise.resolve({
      consume: () => Promise.resolve((async function* () {})()),
      fetch: () => Promise.resolve((async function* () {})()),
    }),
};

const noopJsm = {
  streams: {
    add: () => Promise.resolve({}),
    update: () => Promise.resolve({}),
    get: () => Promise.resolve(noopStream),
    info: () => Promise.resolve({ state: { messages: 0, last_seq: 0, first_seq: 0 } }),
    purge: () => Promise.resolve({}),
  },
  consumers: {
    add: () => Promise.resolve({}),
    delete: () => Promise.resolve({}),
  },
  jetstream: () => ({
    publish: () => Promise.resolve({ seq: 0 }),
  }),
};

const noopNc = {
  subscribe: () => (async function* () {})(),
  publish: () => {},
};

void mock.module("../src/infra/nats/kvm", () => ({
  getKvManager: () => Promise.resolve(noopKvm),
}));

void mock.module("../src/infra/nats/jsm", () => ({
  getJetStreamManager: () => Promise.resolve(noopJsm),
}));

void mock.module("../src/infra/nats/connection", () => ({
  getNatsConnection: () => Promise.resolve(noopNc),
  onNatsReconnect: () => {},
}));
