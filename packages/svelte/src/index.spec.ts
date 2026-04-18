import { describe, expect, test } from "bun:test";
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
  CustomBlock,
  Block as BlockType,
} from "@contfu/core";

function html(
  component: Parameters<typeof render>[0],
  props: Parameters<typeof render>[1]["props"],
): string {
  return render(component, { props }).body.replace(/<!--[[/\]!].*?-->/g, "");
}

describe("Block (Svelte)", () => {
  test("paragraph", () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    expect(html(Block, { block: p })).toBe("<p>hello</p>");
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
      "<table><tr><th>Name</th></tr><tr><td>Alice</td></tr></table>",
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

  test("custom block renders children", () => {
    const inner: ParagraphBlock = ["p", ["hi"]];
    const custom: CustomBlock = ["x", "Widget", {}, [inner]];
    expect(html(Block, { block: custom })).toBe("<p>hi</p>");
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
});
