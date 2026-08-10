import { beforeEach, describe, expect, test } from "bun:test";
import { createFile } from "../features/files/createFile";
import { truncateAllTables } from "../../test/setup";
import { buildFileOpts, handleFileRequest } from "./http";

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

      expect(response.status).toBe(404);
    }
  });
});
