import type { MediaStore } from "@contfu/client";

let store: MediaStore;

if (process.env.ASSETS_URL) {
  const { FileStore } = await import("@contfu/bun-file-store");
  store = new FileStore(process.env.ASSETS_URL);
} else {
  const { mediaStore } = await import("@contfu/client");
  store = mediaStore;
}

export const mediaStore: MediaStore = store;
