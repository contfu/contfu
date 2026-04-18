import { describe, expect, test } from "bun:test";
import { renderToString } from "solid-js/web";
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

function render(el: () => unknown): string {
  return renderToString(el as Parameters<typeof renderToString>[0]);
}

describe("Block (Solid)", () => {
  test("paragraph", () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    expect(render(() => <Block block={p} />)).toBe("<p>hello</p>");
  });

  test("h1", () => {
    const h: Heading1Block = ["1", ["Title"]];
    expect(render(() => <Block block={h} />)).toBe("<h1>Title</h1>");
  });

  test("h2", () => {
    const h: Heading2Block = ["2", ["Sub"]];
    expect(render(() => <Block block={h} />)).toBe("<h2>Sub</h2>");
  });

  test("h3", () => {
    const h: Heading3Block = ["3", ["Section"]];
    expect(render(() => <Block block={h} />)).toBe("<h3>Section</h3>");
  });

  test("blockquote", () => {
    const q: QuoteBlock = ["q", ["quoted"]];
    expect(render(() => <Block block={q} />)).toBe("<blockquote>quoted</blockquote>");
  });

  test("code block", () => {
    const c: CodeBlock = ["c", "ts", "const x = 1;"];
    expect(render(() => <Block block={c} />)).toBe(
      '<pre><code class="language-ts">const x = 1;</code></pre>',
    );
  });

  test("unordered list", () => {
    const ul: UnorderedListBlock = ["u", ["a"], ["b"]];
    expect(render(() => <Block block={ul} />)).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  test("ordered list", () => {
    const ol: OrderedListBlock = ["o", ["1"], ["2"]];
    expect(render(() => <Block block={ol} />)).toBe("<ol><li>1</li><li>2</li></ol>");
  });

  test("table with header", () => {
    const t: TableBlock = ["t", true, [[["Name"]], [["Alice"]]]];
    expect(render(() => <Block block={t} />)).toBe(
      "<table><tr><th>Name</th></tr><tr><td>Alice</td></tr></table>",
    );
  });

  test("image with default baseUrl", () => {
    const img: ImageBlock = ["i", "abc.png", "alt text"];
    expect(render(() => <Block block={img} />)).toBe('<img src="/files/abc.png" alt="alt text">');
  });

  test("image with file prop", () => {
    const img: ImageBlock = ["i", "abc.png", "alt"];
    expect(render(() => <Block block={img} file={{ baseUrl: "/assets" }} />)).toBe(
      '<img src="/assets/abc.png" alt="alt">',
    );
  });

  test("image with imgExt override", () => {
    const img: ImageBlock = ["i", "abc.png", "x"];
    expect(render(() => <Block block={img} file={{ imgExt: "avif" }} />)).toBe(
      '<img src="/files/abc.avif" alt="x">',
    );
  });

  test("custom block renders children", () => {
    const inner: ParagraphBlock = ["p", ["hi"]];
    const custom: CustomBlock = ["x", "Widget", {}, [inner]];
    expect(render(() => <Block block={custom} />)).toBe("<p>hi</p>");
  });
});

describe("Blocks (Solid)", () => {
  test("renders list of blocks", () => {
    const blocks: BlockType[] = [
      ["1", ["Title"]] as Heading1Block,
      ["p", ["Body"]] as ParagraphBlock,
    ];
    expect(render(() => <Blocks blocks={blocks} />)).toBe("<h1>Title</h1><p>Body</p>");
  });

  test("empty array", () => {
    expect(render(() => <Blocks blocks={[]} />)).toBe("");
  });
});
