# Media File optimization

The Contfu runtime processes images, video, and audio in two places inside the application boundary: once when `@contfu/contfu` downloads Files referenced by synced content, and again on demand when a browser requests a File. Contfu synchronizes item data and File references; it does not own storage or processing.

## Set up

Pass a `fileStore` (where runtime File bytes live) and a `mediaOptimizer` (how Media File conversion runs) to `contfu()`:

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

Without an optimizer, Files are still downloaded and stored by the Contfu runtime but aren't converted — they're served as uploaded.

## Canonical Media Masters

The Contfu runtime keeps a **Canonical Media Master** for each image, video, or audio file by default. It derives the sync-time output and any on-demand or pre-generated variants from this local master, so future configuration changes do not normally need the service URL again.

A master is a working, normalized representation — not an archive of the source upload. In particular, its default conversions are lossy. Keep the original file elsewhere when you need original bytes or a preservation-grade asset.

| Media type | Default canonical master                       |
| ---------- | ---------------------------------------------- |
| Image      | AVIF, quality `90`                             |
| Video      | MP4 with H.264 (`libx264`) video and AAC audio |
| Audio      | Opus (`libopus`), `160k` bitrate               |

Set `mediaMaster` to override a type. Omitted types keep their defaults; set a type to `false` to opt that type out, or set the complete option to `false` to opt out globally:

```ts
contfu({
  mediaMaster: {
    image: { format: "webp", quality: 82 },
    video: false,
    audio: { format: "aac", codec: "aac", bitrate: "128k" },
  },
});

// Do not store canonical masters for any media type.
contfu({ mediaMaster: false });
```

## Runtime conversion with `transformMedia`

`transformMedia` rules run once per downloaded File during runtime synchronization. Use them to convert media masters to a modern format, strip EXIF, or restrict to specific collections.

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

### Reprocess after a configuration change

When `localFiles` is enabled (the default) and Canonical Media Masters remain enabled, startup compares every ready file's saved master configuration with the current `mediaMaster` and any explicitly supplied `transformMedia` or pre-generated `mediaVariants` settings. If they differ and a Canonical Media Master exists, the Contfu runtime rebuilds the derived file and configured pre-generated variants from that master without downloading the source URL again.

To clear prior transform rules or pre-generation, supply `transformMedia: []` or `mediaVariants: {}`; omitting either option preserves its stored per-file settings during reconciliation. Setting `mediaMaster: false` disables this reconciliation; it does not rebuild, remove, or repair existing ready files and masters. This is local reprocessing, not source-original preservation: a rebuild starts from the normalized master, which may already be lossy. Files without a usable master require normal source-based repair instead.

## On-demand variants with `mediaVariants`

Browsers request files by URL. You can expose named presets so pages ask for `?variant=thumbnail` instead of spelling out every dimension.

```ts
contfu({
  mediaVariants: {
    default: {
      presets: {
        thumbnail: { resize: { width: 320, height: 320, fit: "cover" }, quality: 70 },
        hero: { resize: { width: 1600 }, quality: 80 },
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
- **`pregenerate`** — preset names to build during runtime synchronization so the first request is a cache hit.
- **`strict: true`** — reject requests that don't name a known preset. Use this to stop bots from hammering your optimizer with `?w=9999`.

`collections.<name>` overrides `default` when a file belongs to that collection (pass `?collection=<name>` with the request).

## Serving Files

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

| Param        | Short | Effect                             |
| ------------ | ----- | ---------------------------------- |
| `width`      | `w`   | resize width                       |
| `height`     | `h`   | resize height                      |
| `fit`        | `f`   | `cover` / `contain` / `inside` / … |
| `quality`    | `q`   | encoder quality                    |
| `rotate`     | `r`   | degrees                            |
| `cropLeft`   | `cl`  | crop origin x                      |
| `cropTop`    | `ct`  | crop origin y                      |
| `cropWidth`  | `cw`  | crop width (required for crop)     |
| `cropHeight` | `ch`  | crop height (required for crop)    |

Video and audio URLs accept codec/bitrate params directly (`videoCodec`, `audioBitrate`, `fps`, …).

The extension in the URL (`.avif`, `.webp`, `.mp4`) picks the output format. Contfu serves the file from a variant cache once built, so the same URL is cheap to hit repeatedly.

## Typing collection names

If you generate a type map via `contfu<CMap>()`, Contfu will enforce collection names at the type level on `transformMedia[].collections`, `mediaVariants.collections`, and the `collection` arg to `loadFile`. Without a `CMap`, these fall back to plain `string`.

```ts
import type { CMap } from "./generated/contfu-types";
const app = contfu<CMap>({
  /* … */
});
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
        hero: { resize: { width: 1600 } },
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
          "64": { resize: { width: 64, height: 64, fit: "cover" } },
          "256": { resize: { width: 256, height: 256, fit: "cover" } },
        },
        strict: true,
      },
    },
  },
});
```
