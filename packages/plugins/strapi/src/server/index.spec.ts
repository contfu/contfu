import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type Handler = (data: unknown) => void | Promise<void>;
type Plugin = () => { bootstrap(args: { strapi: Strapi }): void };
type Strapi = {
  log: {
    debug: ReturnType<typeof mock>;
    info: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
    error: ReturnType<typeof mock>;
  };
  config: { get<T>(key: string, fallback: T): T };
  store: (options: { type: "plugin"; name: string }) => {
    get(options: { key: string }): Promise<unknown>;
    set(options: { key: string; value: unknown }): Promise<void>;
  };
  eventHub: { on(event: string, handler: Handler): void };
};

let plugin: Plugin;
let tempDir: string;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "contfu-strapi-plugin-test-"));
  const packageRoot = new URL("../..", import.meta.url).pathname;
  const outputPath = join(tempDir, "index.js");
  const build = Bun.spawn(
    [
      "bun",
      "build",
      "src/server/index.ts",
      "--target=node",
      "--format=cjs",
      `--outfile=${outputPath}`,
    ],
    { cwd: packageRoot, stdout: "ignore", stderr: "pipe" },
  );
  if ((await build.exited) !== 0) {
    throw new Error(`Failed to build Strapi plugin: ${await new Response(build.stderr).text()}`);
  }
  const module = await import(pathToFileURL(outputPath).href);
  plugin = module.default as Plugin;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("sends lifecycle events to the generic endpoint with increasing sequences", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = mock((url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response("OK", { status: 200 });
  }) as typeof fetch;
  const handlers = new Map<string, Handler>();
  const values = new Map<string, unknown>();
  const strapi = createStrapi(handlers, values);
  plugin().bootstrap({ strapi });
  await flush();

  const events = [
    "entry.create",
    "entry.update",
    "entry.delete",
    "entry.publish",
    "entry.unpublish",
  ];
  for (const [index, event] of events.entries()) {
    await handlers.get(event)?.({
      uid: "api::article.article",
      entry: {
        id: index + 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        title: `Article ${index + 1}`,
      },
    });
  }

  expect(calls).toHaveLength(6);
  expect(calls.slice(1).map(({ url }) => url)).toEqual(
    events.map(() => "https://contfu.test/webhooks/contfu/integration"),
  );
  const payloads = calls.slice(1).map(({ init }) => JSON.parse(String(init?.body)));
  expect(payloads.map((payload) => payload.sequence)).toEqual([1, 2, 3, 4, 5]);
  expect(payloads.map((payload) => payload.sourceEvent)).toEqual(events);
  expect(payloads.map((payload) => payload.operation)).toEqual([
    "create",
    "update",
    "delete",
    "create",
    "update",
  ]);
  for (const { init } of calls) {
    if (!init) throw new Error("fetch init was not provided");
    expect((init.headers as Record<string, string>)["x-contfu-signature"]).toMatch(
      /^sha256=[0-9a-f]{64}$/,
    );
  }
});

test("serializes concurrent lifecycle deliveries", async () => {
  const calls: { init?: RequestInit }[] = [];
  let releaseFirst!: () => void;
  const firstStarted = new Promise<void>((resolve) => {
    globalThis.fetch = mock(async (_url: string | URL, init?: RequestInit) => {
      calls.push({ init });
      if (calls.length === 2) {
        resolve();
        await new Promise<void>((release) => {
          releaseFirst = release;
        });
      }
      return new Response("OK", { status: 200 });
    }) as typeof fetch;
  });
  const handlers = new Map<string, Handler>();
  const strapi = createStrapi(handlers, new Map());
  plugin().bootstrap({ strapi });
  await flush();
  const first = handlers.get("entry.update")?.({
    uid: "api::article.article",
    entry: { id: 21, createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
  });
  await firstStarted;
  const second = handlers.get("entry.update")?.({
    uid: "api::article.article",
    entry: { id: 22, createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:01.000Z" },
  });
  expect(calls).toHaveLength(2);
  releaseFirst();
  await Promise.all([first, second]);
  expect(calls).toHaveLength(3);
  expect(JSON.parse(String(calls[1]?.init?.body)).sequence).toBe(1);
  expect(JSON.parse(String(calls[2]?.init?.body)).sequence).toBe(2);
});

test("resends the exact outbox body for a reconstructed retry", async () => {
  const calls: { init?: RequestInit }[] = [];
  globalThis.fetch = mock((_url: string | URL, init?: RequestInit) => {
    calls.push({ init });
    return new Response("temporary failure", { status: calls.length === 2 ? 503 : 200 });
  }) as typeof fetch;
  const handlers = new Map<string, Handler>();
  const strapi = createStrapi(handlers, new Map());
  plugin().bootstrap({ strapi });
  await flush();
  await handlers.get("entry.update")?.({
    uid: "api::article.article",
    entry: {
      id: 8,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  });
  const firstBody = calls[1]?.init?.body;
  await handlers.get("entry.update")?.({
    uid: "api::article.article",
    entry: {
      id: 8,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:01.000Z",
    },
  });

  expect(calls).toHaveLength(3);
  expect(calls[2]?.init?.body).toBe(firstBody);
  expect(JSON.parse(String(calls[2]?.init?.body)).sequence).toBe(1);
});

test("resends the same sequence when Strapi retries a delivery", async () => {
  const calls: { init?: RequestInit }[] = [];
  globalThis.fetch = mock((_url: string | URL, init?: RequestInit) => {
    calls.push({ init });
    return new Response("temporary failure", { status: calls.length === 2 ? 503 : 200 });
  }) as typeof fetch;
  const handlers = new Map<string, Handler>();
  const strapi = createStrapi(handlers, new Map());
  plugin().bootstrap({ strapi });
  await flush();
  const delivery = {
    uid: "api::article.article",
    entry: {
      id: 8,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  };
  await handlers.get("entry.update")?.(delivery);
  await handlers.get("entry.update")?.(delivery);

  expect(calls).toHaveLength(3);
  expect(JSON.parse(String(calls[1]?.init?.body)).sequence).toBe(1);
  expect(calls[2]?.init?.body).toBe(calls[1]?.init?.body);
});

test("retains the sequence across plugin bootstrap and skips malformed events", async () => {
  const calls: { init?: RequestInit }[] = [];
  globalThis.fetch = mock((_url: string | URL, init?: RequestInit) => {
    calls.push({ init });
    return new Response("OK", { status: 200 });
  }) as typeof fetch;
  const handlers = new Map<string, Handler>();
  const values = new Map<string, unknown>();
  const strapi = createStrapi(handlers, values);
  plugin().bootstrap({ strapi });
  await flush();
  await handlers.get("entry.update")?.({
    uid: "api::article.article",
    entry: { title: "missing identity" },
  });
  expect(calls).toHaveLength(1);

  const restartedHandlers = new Map<string, Handler>();
  plugin().bootstrap({ strapi: createStrapi(restartedHandlers, values) });
  await flush();
  await restartedHandlers.get("entry.update")?.({
    uid: "api::article.article",
    entry: {
      id: 9,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  });
  expect(calls).toHaveLength(3);
  expect(JSON.parse(String(calls[2]?.init?.body)).sequence).toBe(1);
  expect(values.size).toBe(1);
});

function createStrapi(handlers: Map<string, Handler>, values: Map<string, unknown>): Strapi {
  return {
    log: { debug: mock(), info: mock(), warn: mock(), error: mock() },
    config: {
      get<T>(key: string, fallback: T): T {
        if (key === "plugin.contfu") {
          return {
            webhookUrl: "https://contfu.test/webhooks/contfu/integration",
            webhookSecret: "secret",
          } as T;
        }
        return fallback;
      },
    },
    store: () => ({
      get({ key }) {
        return values.get(key);
      },
      set({ key, value }) {
        values.set(key, value);
      },
    }),
    eventHub: {
      on(event, handler) {
        handlers.set(event, handler);
      },
    },
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});
