import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunFileStore } from "./file-store";

describe("BunFileStore", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
    );
  });

  async function createTestStore() {
    const root = await fs.mkdtemp(join(tmpdir(), "contfu-test-"));
    tempRoots.push(root);
    return { root, store: new BunFileStore(root) };
  }

  describe("exists()", () => {
    it("should return false, if no file exists", async () => {
      const { store } = await createTestStore();
      const exists = await store.exists("test");
      expect(exists).toBe(false);
    });

    it("should return true, if file exists", async () => {
      const { root, store } = await createTestStore();
      await Bun.write(join(root, "test"), "");
      const exists = await store.exists("test");
      expect(exists).toBe(true);
    });
  });

  describe("write()", () => {
    it("should create a file", async () => {
      const { root, store } = await createTestStore();
      await store.write("test", Buffer.from("test"));

      const content = await Bun.file(join(root, "test")).text();

      expect(content).toEqual("test");
    });

    it("should overwrite content", async () => {
      const { root, store } = await createTestStore();
      await Bun.write(join(root, "test"), "test");

      await store.write("test", Buffer.from("test2"));

      const content = await Bun.file(join(root, "test")).text();
      expect(content).toEqual("test2");
    });
  });

  describe("read()", () => {
    it("should read a file", async () => {
      const { root, store } = await createTestStore();
      await Bun.write(join(root, "test"), "test");

      const content = await store.read("test");

      expect(content).toEqual(Buffer.from("test"));
    });

    it("should return null, if file does not exist", async () => {
      const { store } = await createTestStore();
      const content = await store.read("test");

      expect(content).toBeNull();
    });
  });
});
