import { beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import { FileStore } from "./file-store";

describe("FileStore", () => {
  const store = new FileStore("/tmp/contfu-test");

  beforeEach(async () => {
    await fs.rm("/tmp/contfu-test", { recursive: true, force: true });
    await fs.mkdir("/tmp/contfu-test", { recursive: true });
  });

  describe("exists()", () => {
    it("should return false, if no file exists", async () => {
      const exists = await store.exists("test");
      expect(exists).toBe(false);
    });

    it("should return true, if file exists", async () => {
      await Bun.write("/tmp/contfu-test/test", "");
      const exists = await store.exists("test");
      expect(exists).toBe(true);
    });
  });

  describe("write()", () => {
    it("should create a file", async () => {
      await store.write("test", Buffer.from("test"));

      const content = await Bun.file("/tmp/contfu-test/test").text();

      expect(content).toEqual("test");
    });

    it("should overwrite content", async () => {
      await Bun.write("/tmp/contfu-test/test", "test");

      await store.write("test", Buffer.from("test2"));

      const content = await Bun.file("/tmp/contfu-test/test").text();
      expect(content).toEqual("test2");
    });
  });

  describe("read()", () => {
    it("should read a file", async () => {
      await Bun.write("/tmp/contfu-test/test", "test");

      const content = await store.read("test");

      expect(content).toEqual(Buffer.from("test"));
    });

    it("should return null, if file does not exist", async () => {
      const content = await store.read("test");

      expect(content).toBeNull();
    });
  });
});
