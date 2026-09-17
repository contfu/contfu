import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const packageJsonPath = new URL("../../package.json", import.meta.url);

async function createInstalledPackage(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "contfu-strapi-exports-"));
  const packageDir = join(tempDir, "node_modules", "@contfu", "strapi");
  await mkdir(join(packageDir, "dist", "server"), { recursive: true });
  await writeFile(join(packageDir, "package.json"), await readFile(packageJsonPath, "utf8"));
  await writeFile(
    join(packageDir, "dist", "server", "index.js"),
    "module.exports = () => ({ name: 'contfu' });\n",
  );
  await writeFile(
    join(packageDir, "dist", "server", "index.d.ts"),
    "declare const plugin: () => unknown; export = plugin;\n",
  );
  return tempDir;
}

describe("package exports", () => {
  test("publishes a human-readable Strapi plugin description", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      strapi?: { description?: unknown };
    };
    const description = packageJson.strapi?.description;

    expect(description).toBe("Send signed Strapi webhooks to Contfu.");
    expect(description).not.toContain("global.plugins.contfu.description");
  });

  test("exposes the Strapi plugin at the package root", async () => {
    const tempDir = await createInstalledPackage();

    try {
      const result = spawnSync(
        process.execPath,
        [
          "-e",
          "const plugin = require('@contfu/strapi'); if (typeof plugin !== 'function') process.exit(2);",
        ],
        { cwd: tempDir, encoding: "utf8" },
      );

      expect(result.status, result.stderr).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("the real bundle sends a normalized lifecycle push under Node without Bun globals", async () => {
    const tempDir = await createInstalledPackage();
    try {
      const build = await Bun.build({
        entrypoints: [new URL("./index.ts", import.meta.url).pathname],
        target: "node",
        format: "cjs",
      });
      expect(build.success).toBe(true);
      await writeFile(
        join(tempDir, "node_modules/@contfu/strapi/dist/server/index.js"),
        await build.outputs[0].text(),
      );
      const result = spawnSync(
        "node",
        [
          "-e",
          `
        const assert = require('node:assert/strict');
        assert.equal(typeof Bun, 'undefined');
        const pushes = [];
        global.fetch = async (_url, init) => {
          pushes.push(JSON.parse(init.body));
          return new Response('OK');
        };
        const handlers = {};
        let stored;
        require('@contfu/strapi')().bootstrap({ strapi: {
          log: { debug() {}, info() {}, warn() {}, error(message, error) { throw error ?? new Error(message); } },
          config: { get(key, fallback) { return key === 'plugin.contfu'
            ? { webhookUrl: 'https://example.com/webhooks/contfu/uid', webhookSecret: 'test-secret' } : fallback; } },
          store() { return { async get() { return stored; }, async set({ value }) { stored = value; } }; },
          contentType() { return { attributes: { related: { type: 'relation', target: 'api::article.article' } } }; },
          eventHub: { on(event, handler) { handlers[event] = handler; } },
        } });
        (async () => {
          await handlers['entry.update']({ uid: 'api::article.article', entry: {
            id: 1, documentId: 'source', title: 'Node push',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z',
            related: { id: 2, documentId: 'destination' },
          } });
          const push = pushes.find(entry => entry.operation === 'update');
          assert.ok(push, JSON.stringify(pushes));
          assert.equal(push.properties.title, 'Node push');
          assert.ok(push.properties.related);
          assert.equal(push.sequence, 1);
        })().catch(error => { console.error(error); process.exitCode = 1; });
      `,
        ],
        { cwd: tempDir, encoding: "utf8" },
      );
      expect(result.status, result.stderr).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("keeps the explicit strapi-server subpath exported", async () => {
    const tempDir = await createInstalledPackage();

    try {
      const result = spawnSync(
        process.execPath,
        [
          "-e",
          "const plugin = require('@contfu/strapi/strapi-server'); if (typeof plugin !== 'function') process.exit(2);",
        ],
        { cwd: tempDir, encoding: "utf8" },
      );

      expect(result.status, result.stderr).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
