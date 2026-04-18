import { describe, expect, test } from "bun:test";
import { buildFileOpts } from "./http";

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
