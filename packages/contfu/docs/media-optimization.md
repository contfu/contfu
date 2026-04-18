# Media optimization

Contfu processes images, video, and audio in two places: once when content syncs from the CMS, and again on demand when a browser requests a file.

## Set up

Pass a `fileStore` (where raw bytes live) and a `mediaOptimizer` (how conversion runs) to `contfu()`:

```ts
import { contfu } from "@contfu/contfu";
import { BunFileStore } from "@contfu/bun-file-store";
import { M4kOptimizer } from "@contfu/media-optimizer";

const app = contfu({
  fileStore: new BunFileStore("/var/contfu/files"),
  mediaOptimizer: new M4kOptimizer(),
});
```

Two optimizers ship with Contfu:

- `@contfu/media-optimizer` — runs locally (sharp + ffmpeg).
- `@contfu/media-optimizer-remote` — calls a remote worker. Used automatically when `M4K_URL` is set.

Without an optimizer, files still sync but aren't converted — they're served as uploaded.

## Sync-time conversion with `transformMedia`

`transformMedia` rules run once per file during sync. Use them to convert masters to a modern format, strip EXIF, or restrict to specific collections.

```ts
contfu({
  transformMedia: [
    {
      mediaType: "image",
      format: "avif",
      quality: 75,
      resize: { width: 2400, fit: "inside" },
      include: ["jpg", "jpeg", "png"],
    },
    {
      mediaType: "video",
      format: "mp4",
      videoCodec: "h264",
      videoBitrate: "2M",
      collections: ["products"],
    },
  ],
});
```

Each rule matches by `mediaType` and, optionally, `collections` and `include`/`exclude` extensions. The first matching rule wins. Files that match no rule pass through untouched.

## On-demand variants with `mediaVariants`

Browsers request files by URL. You can expose named presets so pages ask for `?variant=thumbnail` instead of spelling out every dimension.

```ts
contfu({
  mediaVariants: {
    default: {
      presets: {
        thumbnail: { resize: { width: 320, height: 320, fit: "cover" }, quality: 70 },
        hero:      { resize: { width: 1600 }, quality: 80 },
      },
      pregenerate: ["thumbnail"],
      strict: true,
    },
    collections: {
      avatars: {
        presets: {
          small: { resize: { width: 64, height: 64, fit: "cover" } },
          large: { resize: { width: 256, height: 256, fit: "cover" } },
        },
        strict: true,
      },
    },
  },
});
```

Three knobs:

- **`presets`** — named conversion recipes. Request with `?variant=<name>`.
- **`pregenerate`** — preset names to build during sync so the first request is a cache hit.
- **`strict: true`** — reject requests that don't name a known preset. Use this to stop bots from hammering your optimizer with `?w=9999`.

`collections.<name>` overrides `default` when a file belongs to that collection (pass `?collection=<name>` with the request).

## Serving files

Route file requests to `handleFileRequest`:

```ts
if (url.pathname.startsWith("/files/")) {
  return app.handleFileRequest(request, url.pathname.slice("/files/".length));
}
```

### Request URLs

Named preset:

```
/files/<id>.avif?variant=hero&collection=articles
```

Raw params (only usable when `strict` is off):

| Param         | Short | Effect                             |
| ------------- | ----- | ---------------------------------- |
| `width`       | `w`   | resize width                       |
| `height`      | `h`   | resize height                      |
| `fit`         | `f`   | `cover` / `contain` / `inside` / … |
| `quality`     | `q`   | encoder quality                    |
| `rotate`      | `r`   | degrees                            |
| `cropLeft`    | `cl`  | crop origin x                      |
| `cropTop`     | `ct`  | crop origin y                      |
| `cropWidth`   | `cw`  | crop width (required for crop)     |
| `cropHeight`  | `ch`  | crop height (required for crop)    |

Video and audio URLs accept codec/bitrate params directly (`videoCodec`, `audioBitrate`, `fps`, …).

The extension in the URL (`.avif`, `.webp`, `.mp4`) picks the output format. Contfu serves the file from a variant cache once built, so the same URL is cheap to hit repeatedly.

## Typing collection names

If you generate a type map via `contfu<CMap>()`, Contfu will enforce collection names at the type level on `transformMedia[].collections`, `mediaVariants.collections`, and the `collection` arg to `loadFile`. Without a `CMap`, these fall back to plain `string`.

```ts
import type { CMap } from "./generated/contfu-types";
const app = contfu<CMap>({ /* … */ });
```

## Recipes

**Web-safe image pipeline** — convert all uploads to AVIF, expose thumbnail/hero presets, lock down arbitrary dimensions:

```ts
contfu({
  transformMedia: [
    { mediaType: "image", format: "avif", quality: 75, resize: { width: 2400, fit: "inside" } },
  ],
  mediaVariants: {
    default: {
      presets: {
        thumb: { resize: { width: 320, height: 320, fit: "cover" } },
        hero:  { resize: { width: 1600 } },
      },
      pregenerate: ["thumb"],
      strict: true,
    },
  },
});
```

**Per-collection avatars** — square crops only, no leak to other collections:

```ts
contfu<CMap>({
  mediaVariants: {
    collections: {
      users: {
        presets: {
          "64":  { resize: { width: 64,  height: 64,  fit: "cover" } },
          "256": { resize: { width: 256, height: 256, fit: "cover" } },
        },
        strict: true,
      },
    },
  },
});
```
