import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Blocks, Block, FileUrlContext } from "./index";
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
} from "@contfu/core";
import type { BlockComponents } from "./index";
import React from "react";

function render(el: React.ReactNode): string {
  return renderToStaticMarkup(el as React.ReactElement);
}

describe("Block (React)", () => {
  test("paragraph", () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    expect(render(<Block block={p} />)).toBe("<p>hello</p>");
  });

  test("h1", () => {
    const h: Heading1Block = ["1", ["Title"]];
    expect(render(<Block block={h} />)).toBe("<h1>Title</h1>");
  });

  test("h2", () => {
    const h: Heading2Block = ["2", ["Sub"]];
    expect(render(<Block block={h} />)).toBe("<h2>Sub</h2>");
  });

  test("h3", () => {
    const h: Heading3Block = ["3", ["Section"]];
    expect(render(<Block block={h} />)).toBe("<h3>Section</h3>");
  });

  test("blockquote", () => {
    const q: QuoteBlock = ["q", ["quoted"]];
    expect(render(<Block block={q} />)).toBe("<blockquote>quoted</blockquote>");
  });

  test("code block", () => {
    const c: CodeBlock = ["c", "ts", "const x = 1;"];
    expect(render(<Block block={c} />)).toBe(
      '<pre><code class="language-ts">const x = 1;</code></pre>',
    );
  });

  test("unordered list", () => {
    const ul: UnorderedListBlock = ["u", ["a"], ["b"]];
    expect(render(<Block block={ul} />)).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  test("ordered list", () => {
    const ol: OrderedListBlock = ["o", ["1"], ["2"]];
    expect(render(<Block block={ol} />)).toBe("<ol><li>1</li><li>2</li></ol>");
  });

  test("table with header", () => {
    const t: TableBlock = ["t", true, [[["Name"]], [["Alice"]]]];
    expect(render(<Block block={t} />)).toBe(
      "<table><tr><th>Name</th></tr><tr><td>Alice</td></tr></table>",
    );
  });

  test("image with default baseUrl", () => {
    const img: ImageBlock = ["i", "abc123.png", "alt text"];
    expect(render(<Block block={img} />)).toContain(
      '<img src="/files/abc123.png" alt="alt text"/>',
    );
  });

  test("image with file prop", () => {
    const img: ImageBlock = ["i", "abc123.png", "alt"];
    expect(render(<Block block={img} file={{ baseUrl: "/assets" }} />)).toContain(
      '<img src="/assets/abc123.png" alt="alt"/>',
    );
  });

  test("image with FileUrlContext provider", () => {
    const img: ImageBlock = ["i", "abc.png", "alt"];
    expect(
      render(
        <FileUrlContext.Provider value={{ baseUrl: "/ctx" }}>
          <Block block={img} />
        </FileUrlContext.Provider>,
      ),
    ).toContain('<img src="/ctx/abc.png" alt="alt"/>');
  });

  test("image: prop beats context", () => {
    const img: ImageBlock = ["i", "abc.png", "alt"];
    expect(
      render(
        <FileUrlContext.Provider value={{ baseUrl: "/ctx" }}>
          <Block block={img} file={{ baseUrl: "/prop" }} />
        </FileUrlContext.Provider>,
      ),
    ).toContain('<img src="/prop/abc.png" alt="alt"/>');
  });

  test("custom block renders children", () => {
    const inner: ParagraphBlock = ["p", ["hi"]];
    const custom: CustomBlock = ["x", "Widget", {}, [inner]];
    expect(render(<Block block={custom} />)).toBe("<p>hi</p>");
  });
});

describe("Blocks (React)", () => {
  test("renders list of blocks", () => {
    const blocks = [["1", ["Title"]] as Heading1Block, ["p", ["Body"]] as ParagraphBlock];
    expect(render(<Blocks blocks={blocks} />)).toBe("<h1>Title</h1><p>Body</p>");
  });

  test("empty array", () => {
    expect(render(<Blocks blocks={[]} />)).toBe("");
  });
});

describe("Block custom components", () => {
  test("overrides paragraph", () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    const components: BlockComponents = {
      p: ({ children }) => <p className="lead">{children}</p>,
    };
    expect(render(<Block block={p} components={components} />)).toBe('<p class="lead">hello</p>');
  });

  test("overrides image", () => {
    const img: ImageBlock = ["i", "abc.png", "alt"];
    const components: BlockComponents = {
      img: ({ block }) => <img src={block[1]} alt={block[2]} className="custom-img" />,
    };
    expect(render(<Block block={img} components={components} />)).toContain(
      '<img src="abc.png" alt="alt" class="custom-img"/>',
    );
  });

  test("overrides code block", () => {
    const c: CodeBlock = ["c", "js", "var x;"];
    const components: BlockComponents = {
      pre: ({ block }) => (
        <div className="code-block" data-lang={block[1]}>
          <pre>{block[2]}</pre>
        </div>
      ),
    };
    expect(render(<Block block={c} components={components} />)).toBe(
      '<div class="code-block" data-lang="js"><pre>var x;</pre></div>',
    );
  });
});
