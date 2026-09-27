import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createFile } from "../features/files/createFile";
import { truncateAllTables } from "../../test/setup";
import { buildFileOpts, handleFileRequest } from "./http";

const originalFetch = globalThis.fetch;
const originalCloudUrl = process.env.CONTFU_INTERNAL_CLOUD_URL;
const originalKey = process.env.CONTFU_KEY;

describe("buildFileOpts", () => {
  test("builds image conversion options from query params", () => {
    const url = new URL("http://localhost/files/file.avif?w=640&q=80");

    expect(buildFileOpts(url, "image")).toEqual({
      mediaType: "image",
      quality: 80,
      rotate: undefined,
      resize: { width: 640, height: undefined, fit: undefined },
    });
  });

  test("returns null when no transform params are present", () => {
    const url = new URL("http://localhost/files/file.avif");
    expect(buildFileOpts(url, "image")).toBeNull();
  });

  test("returns null for non-media file extensions", () => {
    const url = new URL("http://localhost/files/file.bin?w=640");
    expect(buildFileOpts(url, null)).toBeNull();
  });
});

describe("handleFileRequest", () => {
  beforeEach(() => {
    truncateAllTables();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
    if (originalCloudUrl === undefined) delete process.env.CONTFU_INTERNAL_CLOUD_URL;
    else process.env.CONTFU_INTERNAL_CLOUD_URL = originalCloudUrl;
    if (originalKey === undefined) delete process.env.CONTFU_KEY;
    else process.env.CONTFU_KEY = originalKey;
  });

  test("redirects a pending id.ext file to its safe source URL", async () => {
    createFile({
      id: "0123456789abcdef",
      status: "pending",
      ext: "png",
      size: 0,
      mediaType: "image",
      data: Buffer.from("https://cdn.example.com/logo.png?signature=fresh"),
      createdAt: 1,
    });

    const response = await handleFileRequest(
      new Request("http://localhost/files/0123456789abcdef.png"),
      "0123456789abcdef.png",
      {
        fileStore: {
          read: () => Promise.resolve(null),
          write: () => Promise.resolve(),
          exists: () => Promise.resolve(false),
        },
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://cdn.example.com/logo.png?signature=fresh",
    );
  });

  test.each(["", ".bin"])(
    "proxies pending managed references %s without forwarding credentials",
    async (suffix) => {
      const id = suffix ? "0123456789abcdee" : "0123456789abcded";
      const key = Buffer.alloc(32, 7);
      process.env.CONTFU_INTERNAL_CLOUD_URL = "https://cloud.example";
      process.env.CONTFU_KEY = key.toString("base64url");
      createFile({
        id,
        status: "pending",
        ext: "png",
        size: 0,
        mediaType: "image",
        data: Buffer.from("https://cloud.example/api/files/1"),
        createdAt: 1,
      });
      const calls: Array<{ url: string; authorization: string | null }> = [];
      globalThis.fetch = mock((input: string | URL | Request, init?: RequestInit) => {
        const target = String(input);
        calls.push({ url: target, authorization: new Headers(init?.headers).get("authorization") });
        if (target === "https://cloud.example/api/files/1") {
          return Promise.resolve(
            new Response(null, {
              status: 302,
              headers: { Location: "https://provider.example/file.png" },
            }),
          );
        }
        return Promise.resolve(
          new Response("image-bytes", {
            headers: { "Content-Type": "text/html" },
          }),
        );
      }) as unknown as typeof fetch;

      const path = `${id}${suffix}`;
      const response = await handleFileRequest(
        new Request(`http://localhost/files/${path}`),
        path,
        {
          fileStore: {
            read: () => Promise.resolve(null),
            write: () => Promise.resolve(),
            exists: () => Promise.resolve(false),
          },
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe("image-bytes");
      expect(calls).toEqual([
        {
          url: "https://cloud.example/api/files/1",
          authorization: `Bearer ${key.toString("base64url")}`,
        },
        { url: "https://provider.example/file.png", authorization: null },
      ]);
    },
  );

  test("returns temporary unavailability for managed files without credentials", async () => {
    process.env.CONTFU_INTERNAL_CLOUD_URL = "https://cloud.example";
    delete process.env.CONTFU_KEY;
    createFile({
      id: "0123456789abcdef",
      status: "pending",
      ext: "png",
      size: 0,
      mediaType: "image",
      data: Buffer.from("https://cloud.example/api/files/1"),
      createdAt: 1,
    });
    const response = await handleFileRequest(
      new Request("http://localhost/files/0123456789abcdef.bin"),
      "0123456789abcdef.bin",
      {
        fileStore: {
          read: () => Promise.resolve(null),
          write: () => Promise.resolve(),
          exists: () => Promise.resolve(false),
        },
      },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
  });

  test("serves a stale extension reference using ready file metadata", async () => {
    const file = createFile({
      id: "0123456789abcdef",
      status: "ready",
      ext: "pdf",
      size: 3,
      mediaType: "file",
      data: Buffer.from("pdf"),
      createdAt: 1,
    });

    const response = await handleFileRequest(
      new Request(`http://localhost/files/${file.id}.bin`),
      `${file.id}.bin`,
      {
        fileStore: {
          read: () => Promise.resolve(null),
          write: () => Promise.resolve(),
          exists: () => Promise.resolve(false),
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(await response.text()).toBe("pdf");
  });

  test("does not redirect a pending file to an unsafe or malformed source URL", async () => {
    for (const [id, source] of [
      ["fedcba9876543210", "file:///private/logo.png"],
      ["fedcba9876543211", "https://cdn.example.com/logo.png\r\nX-Injected: yes"],
    ]) {
      createFile({
        id,
        status: "pending",
        ext: "png",
        size: 0,
        mediaType: "image",
        data: Buffer.from(source),
        createdAt: 1,
      });

      const response = await handleFileRequest(
        new Request(`http://localhost/files/${id}.png`),
        `${id}.png`,
        {
          fileStore: {
            read: () => Promise.resolve(null),
            write: () => Promise.resolve(),
            exists: () => Promise.resolve(false),
          },
        },
      );

      expect(response.status).toBe(503);
    }
  });
});
