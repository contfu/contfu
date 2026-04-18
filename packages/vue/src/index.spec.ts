import { describe, expect, test } from "bun:test";
import { renderToString } from "@vue/server-renderer";
import { createSSRApp } from "vue";
import { Blocks, Block } from "./index";
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
  CustomBlock,
  Block as BlockType,
} from "@contfu/core";

async function render(component: unknown, props: Record<string, unknown>): Promise<string> {
  const app = createSSRApp(component as Parameters<typeof createSSRApp>[0], props);
  const html = await renderToString(app);
  return html.replace(/<!--\[-->/g, "").replace(/<!--\]-->/g, "");
}

describe("Block (Vue)", () => {
  test("paragraph", async () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    expect(await render(Block, { block: p })).toBe("<p>hello</p>");
  });

  test("h1", async () => {
    const h: Heading1Block = ["1", ["Title"]];
    expect(await render(Block, { block: h })).toBe("<h1>Title</h1>");
  });

  test("h2", async () => {
    const h: Heading2Block = ["2", ["Sub"]];
    expect(await render(Block, { block: h })).toBe("<h2>Sub</h2>");
  });

  test("h3", async () => {
    const h: Heading3Block = ["3", ["Section"]];
    expect(await render(Block, { block: h })).toBe("<h3>Section</h3>");
  });

  test("blockquote", async () => {
    const q: QuoteBlock = ["q", ["quoted"]];
    expect(await render(Block, { block: q })).toBe("<blockquote>quoted</blockquote>");
  });

  test("code block", async () => {
    const c: CodeBlock = ["c", "ts", "const x = 1;"];
    expect(await render(Block, { block: c })).toBe(
      '<pre><code class="language-ts">const x = 1;</code></pre>',
    );
  });

  test("unordered list", async () => {
    const ul: UnorderedListBlock = ["u", ["a"], ["b"]];
    expect(await render(Block, { block: ul })).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  test("ordered list", async () => {
    const ol: OrderedListBlock = ["o", ["1"], ["2"]];
    expect(await render(Block, { block: ol })).toBe("<ol><li>1</li><li>2</li></ol>");
  });

  test("table with header", async () => {
    const t: TableBlock = ["t", true, [[["Name"]], [["Alice"]]]];
    expect(await render(Block, { block: t })).toBe(
      "<table><tr><th>Name</th></tr><tr><td>Alice</td></tr></table>",
    );
  });

  test("image with default baseUrl", async () => {
    const img: ImageBlock = ["i", "abc.png", "alt text"];
    expect(await render(Block, { block: img })).toBe('<img src="/files/abc.png" alt="alt text">');
  });

  test("image with file prop", async () => {
    const img: ImageBlock = ["i", "abc.png", "alt"];
    expect(await render(Block, { block: img, file: { baseUrl: "/assets" } })).toBe(
      '<img src="/assets/abc.png" alt="alt">',
    );
  });

  test("image with imgExt override", async () => {
    const img: ImageBlock = ["i", "abc.png", "x"];
    expect(await render(Block, { block: img, file: { imgExt: "avif" } })).toBe(
      '<img src="/files/abc.avif" alt="x">',
    );
  });

  test("custom block renders children", async () => {
    const inner: ParagraphBlock = ["p", ["hi"]];
    const custom: CustomBlock = ["x", "Widget", {}, [inner]];
    expect(await render(Block, { block: custom })).toBe("<p>hi</p>");
  });
});

describe("Blocks (Vue)", () => {
  test("renders list of blocks", async () => {
    const blocks: BlockType[] = [
      ["1", ["Title"]] as Heading1Block,
      ["p", ["Body"]] as ParagraphBlock,
    ];
    expect(await render(Blocks, { blocks })).toBe("<h1>Title</h1><p>Body</p>");
  });

  test("empty array", async () => {
    expect(await render(Blocks, { blocks: [] })).toBe("");
  });
});
