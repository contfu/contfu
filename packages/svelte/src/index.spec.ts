import { afterAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { compile } from "svelte/compiler";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { render } from "svelte/server";
import Blocks from "./Blocks.svelte";
import Block from "./Block.svelte";
import type {
  ParagraphBlock,
  Heading1Block,
  Heading2Block,
  Heading3Block,
  QuoteBlock,
  CodeBlock,
  UnorderedListBlock,
  OrderedListBlock,
  TableBlock,
  ImageBlock,
  Component,
  Block as BlockType,
} from "@contfu/core";

type RenderComponent = Parameters<typeof render>[0];
type SvelteServerRenderer = {
  push: (value: string) => void;
  component?: (render: (renderer: SvelteServerRenderer) => void) => void;
};

type SvelteServerComponentProps = {
  block: Component;
  children?: (renderer: SvelteServerRenderer) => void;
};

const hydrationDir = join(import.meta.dir, ".tmp-hydration");
await mkdir(hydrationDir, { recursive: true });
const clientSvelte = import.meta.resolve("svelte").replace("index-server", "index-client");
for (const name of ["Block", "Inline"]) {
  const source = await Bun.file(join(import.meta.dir, `${name}.svelte`)).text();
  const code = compile(source, { generate: "client", filename: `${name}.svelte` })
    .js.code.replaceAll('"./Inline.svelte"', '"./Inline.js"')
    .replaceAll('"./Block.svelte"', '"./Block.js"')
    .replaceAll('"./index.js"', '"./context.js"')
    .replaceAll('from "svelte"', `from "${clientSvelte}"`);
  await writeFile(join(hydrationDir, `${name}.js`), code);
}
const hostSource = `<script>import Block from './Block.js'; let { block, file } = $props(); let currentFile = $state(file); export function updateFile(next) { currentFile = next; }</script><Block {block} file={currentFile} />`;
const hostCode = compile(hostSource, {
  generate: "client",
  filename: "HydrationHost.svelte",
}).js.code.replaceAll('from "svelte"', `from "${clientSvelte}"`);
await writeFile(join(hydrationDir, "Host.js"), hostCode);
await writeFile(
  join(hydrationDir, "context.js"),
  'export const FILE_URL_CONTEXT_KEY = Symbol("file");',
);
GlobalRegistrator.register();
const { hydrate, tick } = await import(clientSvelte);
const BrowserHost = (await import(`${hydrationDir}/Host.js?test=${Date.now()}`)).default;
afterAll(async () => {
  await rm(hydrationDir, { recursive: true, force: true });
});

function NamedComponentFixture(
  renderer: SvelteServerRenderer,
  props: SvelteServerComponentProps,
): void {
  const renderComponent = (target: SvelteServerRenderer) => {
    target.push(`<section data-name="${props.block[1]}" data-kind="${props.block[2].kind}">`);
    props.children?.(target);
    target.push("</section>");
  };
  if (renderer.component) renderer.component(renderComponent);
  else renderComponent(renderer);
}

function stripSvelteMarkers(value: string): string {
  let result = "";
  let index = 0;
  while (index < value.length) {
    const start = value.indexOf("<" + "!--", index);
    if (start === -1) return result + value.slice(index);
    result += value.slice(index, start);
    const end = value.indexOf("--" + ">", start + 4);
    if (end === -1) return result + value.slice(start);
    index = end + 3;
  }
  return result;
}

function html(component: unknown, props: Record<string, unknown>): string {
  return stripSvelteMarkers(render(component as RenderComponent, { props: props as never }).body);
}

describe("Block (Svelte)", () => {
  test("paragraph", () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    expect(html(Block, { block: p })).toBe("<p>hello</p>");
  });

  test("applies the core rich-content URL policy to anchors", () => {
    for (const href of ["javascript:alert", "JaVaScRiPt:alert", "gopher://example.com"]) {
      expect(html(Block, { block: ["p", [["a", "link", href]]] })).toBe("<p>link</p>");
    }
    for (const href of [
      "https://example.com/docs",
      "http://example.com",
      "/docs",
      "mailto:user@example.com",
      "tel:+15551212",
    ]) {
      expect(html(Block, { block: ["p", [["a", "link", href]]] })).toBe(
        `<p><a href="${href}">link</a></p>`,
      );
    }
  });

  test("does not activate rejected anchors when parsed by the browser", () => {
    const body = html(Block, {
      block: ["p", [["a", "Run", "JaVaScRiPt:alert"]]],
    });
    const target = document.createElement("div");
    target.innerHTML = body;
    expect(target.querySelector("a")).toBeNull();
    expect(target.textContent).toBe("Run");
  });

  test("h1", () => {
    const h: Heading1Block = ["1", ["Title"]];
    expect(html(Block, { block: h })).toBe("<h1>Title</h1>");
  });

  test("h2", () => {
    const h: Heading2Block = ["2", ["Sub"]];
    expect(html(Block, { block: h })).toBe("<h2>Sub</h2>");
  });

  test("h3", () => {
    const h: Heading3Block = ["3", ["Section"]];
    expect(html(Block, { block: h })).toBe("<h3>Section</h3>");
  });

  test("blockquote", () => {
    const q: QuoteBlock = ["q", ["quoted"]];
    expect(html(Block, { block: q })).toBe("<blockquote>quoted</blockquote>");
  });

  test("code block", () => {
    const c: CodeBlock = ["c", "ts", "const x = 1;"];
    expect(html(Block, { block: c })).toBe(
      '<pre><code class="language-ts">const x = 1;</code></pre>',
    );
  });

  test("code block no lang", () => {
    const c: CodeBlock = ["c", "", "hello"];
    expect(html(Block, { block: c })).toBe("<pre><code>hello</code></pre>");
  });

  test("unordered list", () => {
    const ul: UnorderedListBlock = ["u", ["a"], ["b"]];
    expect(html(Block, { block: ul })).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  test("ordered list", () => {
    const ol: OrderedListBlock = ["o", ["1"], ["2"]];
    expect(html(Block, { block: ol })).toBe("<ol><li>1</li><li>2</li></ol>");
  });

  test("table with header", () => {
    const t: TableBlock = ["t", true, [[["Name"]], [["Alice"]]]];
    expect(html(Block, { block: t })).toBe(
      "<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>",
    );
  });

  test("table without header", () => {
    const t: TableBlock = ["t", false, [[["A"]], [["B"]]]];
    expect(html(Block, { block: t })).toBe(
      "<table><tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody></table>",
    );
  });

  test("image with default baseUrl", () => {
    const img: ImageBlock = ["i", "abc123.png", "alt text"];
    expect(html(Block, { block: img })).toBe('<img src="/files/abc123.png" alt="alt text"/>');
  });

  test("image with file prop", () => {
    const img: ImageBlock = ["i", "abc123.png", "alt"];
    expect(html(Block, { block: img, file: { baseUrl: "/assets" } })).toBe(
      '<img src="/assets/abc123.png" alt="alt"/>',
    );
  });

  test("image with imgExt override", () => {
    const img: ImageBlock = ["i", "abc.png", "x"];
    expect(html(Block, { block: img, file: { imgExt: "avif" } })).toBe(
      '<img src="/files/abc.avif" alt="x"/>',
    );
  });

  test("nested image inherits file options", () => {
    const image: ImageBlock = ["i", "nested.png", "nested"];
    const component: Component = ["x", "Widget", {}, [image]];
    expect(html(Block, { block: component, file: { baseUrl: "/assets" } })).toBe(
      '<img src="/assets/nested.png" alt="nested"/>',
    );
  });

  test("component block renders children", () => {
    const inner: ParagraphBlock = ["p", ["hi"]];
    const component: Component = ["x", "Widget", {}, [inner]];
    expect(html(Block, { block: component })).toBe("<p>hi</p>");
  });

  test("overrides named component block", () => {
    const component: Component = ["x", "Callout", { kind: "info" }, [["p", ["hello"]]]];
    expect(
      html(Block, {
        block: component,
        components: { Callout: NamedComponentFixture },
      }),
    ).toBe('<section data-name="Callout" data-kind="info"><p>hello</p></section>');
  });

  test("hydrates browser-parsed tables without warnings and updates nested image URLs", async () => {
    const nestedImage: ImageBlock = ["i", "nested.png", "nested"];
    const component: Component = ["x", "Widget", {}, [nestedImage]];
    const table = ["t", true, [[["Header"]], [[component]]]] as TableBlock;
    const body = render(Block, { props: { block: table, file: { baseUrl: "/one" } } }).body;
    const target = document.createElement("div");
    target.innerHTML = body;
    document.body.append(target);

    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(" "));
    try {
      const instance = hydrate(BrowserHost, {
        target,
        props: { block: table, file: { baseUrl: "/one" } },
      });
      await tick();
      expect(warnings).toEqual([]);
      expect(target.querySelector("thead th")?.textContent).toBe("Header");
      expect(target.querySelector("img")?.getAttribute("src")).toBe("/one/nested.png");

      instance.updateFile({ baseUrl: "/two" });
      await tick();
      expect(target.querySelector("img")?.getAttribute("src")).toBe("/two/nested.png");
    } finally {
      console.warn = originalWarn;
      target.remove();
    }
  });
});

describe("Blocks (Svelte)", () => {
  test("renders list of blocks", () => {
    const blocks: BlockType[] = [
      ["1", ["Title"]] as Heading1Block,
      ["p", ["Body"]] as ParagraphBlock,
    ];
    expect(html(Blocks, { blocks })).toBe("<h1>Title</h1><p>Body</p>");
  });

  test("empty array", () => {
    expect(html(Blocks, { blocks: [] })).toBe("");
  });

  test("nested image inherits file options", () => {
    const blocks: BlockType[] = [["x", "Widget", {}, [["i", "nested.png", "nested"]]]];
    expect(html(Blocks, { blocks, file: { baseUrl: "/assets" } })).toBe(
      '<img src="/assets/nested.png" alt="nested"/>',
    );
  });
});
