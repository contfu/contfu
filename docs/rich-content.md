# Rich Content & Media

Beyond typed props, items can carry **rich content** — long-form prose modeled as a tree
of structured **blocks** and **inlines**. Contfu normalizes provider rich text (Notion
blocks, Contentful rich text, Strapi blocks, WordPress HTML, …) into one block model
defined in `@contfu/core`, so you render the same shapes regardless of source.

## The block model

Block and inline types live in `@contfu/core`:

- **Blocks** — `ParagraphBlock`, `Heading1Block`/`Heading2Block`/`Heading3Block`,
  `QuoteBlock`, `CodeBlock`, `UnorderedListBlock`, `OrderedListBlock`, `TableBlock`,
  `ImageBlock`, and component blocks (`Component`, tuple shape
  `["x", name, props, children]`) for your [components](./collections.md#components) or
  provider-specific rich nodes that do not have a built-in Contfu equivalent.
- **Inlines** — plain strings plus anchors, inline code, bold, and italic marks.

You rarely touch these directly — render them with a framework adapter, or render to
HTML/Markdown strings. Provider-specific block nodes are preserved as component blocks
when possible instead of being silently dropped; for example, unsupported Contentful rich
text nodes use component names like `contentful.<nodeType>`, unsupported Notion blocks
use names like `notion.<blockType>` with the Notion block payload under `props.notion`,
Sanity Portable Text image objects with resolvable asset URLs become `sanity.image`
component blocks with an image child and raw image metadata in `props`, and custom Sanity
Portable Text objects are emitted as component blocks with their raw `_type` metadata
preserved in `props`.

## Framework adapters

Each adapter exports `Blocks` (render an array) and `Block` (render one). React,
Svelte, Vue, and Solid also let you override the component used for any built-in block type
or named component block via a `components` map. Provide file-URL options via props or
framework context so media blocks resolve to your file endpoint.

| Framework | Package           |
| --------- | ----------------- |
| React     | `@contfu/react`   |
| Svelte    | `@contfu/svelte`  |
| Vue       | `@contfu/vue`     |
| Solid     | `@contfu/solid`   |
| Angular   | `@contfu/angular` |

### React

```tsx
import { Blocks, FileUrlContext } from "@contfu/react";

function Article({ post }) {
  return (
    <FileUrlContext.Provider value={{ baseUrl: "/files" }}>
      <Blocks
        blocks={post.content}
        components={{
          h1: ({ block, children }) => <h1 className="font-display">{children}</h1>,
          Callout: ({ block, children }) => <Callout kind={block[2].kind}>{children}</Callout>,
        }}
      />
    </FileUrlContext.Provider>
  );
}
```

`Block` renders a single block with the same `components` and `file` props. Component
block override keys match the tuple's name field (`["x", name, props, children]`); use
`component` as a generic fallback for component blocks without a name-specific override.

### Svelte / Vue / Solid

The shape mirrors React: import `Blocks` / `Block`, pass a `components` override map, and
supply file-URL options through the framework's context/inject mechanism
(`FILE_URL_CONTEXT_KEY` in Svelte, `FILE_URL_INJECTION_KEY` in Vue).

### Angular

```ts
import { Blocks, CONTFU_FILE_URL } from "@contfu/angular";

@Component({
  imports: [Blocks],
  providers: [{ provide: CONTFU_FILE_URL, useValue: { baseUrl: "/files" } }],
  template: `<contfu-blocks [blocks]="post.content" />`,
})
export class ArticleComponent {}
```

Angular also exports the underlying `BlockComponent` / `BlocksComponent` class names for
projects that prefer explicit Angular component naming. The Angular adapter renders with
Contfu's string renderer; pass core `RenderOptions` through `[options]` to customize
built-in block/inline output, and use `[file]` or `CONTFU_FILE_URL` for media URLs.

## Rendering to strings

For server-side rendering, emails, feeds, or non-component environments, render blocks to
HTML or Markdown with helpers from `@contfu/core` (re-exported from `@contfu/client`):

```ts
import { renderBlocks, renderBlocksMarkdown } from "@contfu/client";

const html = renderBlocks(post.content, {
  blocks: {
    h1: (block, ctx) => `<h1 class="title">${ctx.renderInlines(block[1])}</h1>`,
  },
  file: { baseUrl: "https://cdn.example.com/files" },
});

const md = renderBlocksMarkdown(post.content);
```

Helpers: `renderBlock`, `renderBlocks`, `renderInline`, `renderInlines`, and their
`…Markdown` counterparts. Override any block or inline renderer via `blocks` / `inlines`,
and control media URLs via `file`.

### Server-side rendering through the HTTP client

The HTTP client can render content for you, so the wire payload arrives already
stringified. Pass `contentAs` (and optional `htmlOptions` / `markdownOptions`) on the
query:

```ts
const posts = await query("blogPost", {
  contentAs: "markdown",
  markdownOptions: {
    /* … */
  },
});
// posts[0].content is now a Markdown string
```

## Files and media URLs

Items reference **Files**; image/video/audio blocks reference **Media Files**. The Local
Runtime downloads and stores these inside your boundary — the Cloud Service is never in the
file path. See [Deployment → File & media storage](./deployment.md#file--media-storage).

Adapters and string renderers turn a stored file reference (`<id>.<ext>`) into a URL via
`buildFileUrl`, configured through `FileUrlOptions`:

| Option                             | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `baseUrl`                          | Prefix prepended to the file id. Default `/files`.                           |
| `imgExt` / `videoExt` / `audioExt` | Override the served extension per media type (e.g. serve `avif` for images). |
| `fileUrl`                          | Full escape hatch — return any URL given `{ id, ext, mediaType? }`.          |

Absolute `http(s)` references are passed through unchanged, so externally hosted assets
keep their original URLs.

### Serving files

A [self-hosted Server](./deployment.md#self-hosted-server) exposes the stored files over
HTTP automatically. If you embed the Local Runtime, the `contfu()` instance gives you a
`handleFileRequest(request, filePath)` helper to serve files (including on-demand media
variants) from your own routes — see
[Deployment → Embedded runtime](./deployment.md#embedded-local-runtime).
