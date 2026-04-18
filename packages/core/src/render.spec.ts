import { describe, expect, test } from "bun:test";
import { buildFileUrl, renderBlock, renderBlocks, renderInline, renderInlines } from "./render";
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
  Anchor,
  Code,
  Bold,
  Italic,
  Block,
} from "./blocks";

describe("renderInline", () => {
  test("plain string", () => {
    expect(renderInline("hello")).toBe("hello");
  });

  test("escapes html in strings", () => {
    expect(renderInline("<b>hello</b>")).toBe("&lt;b&gt;hello&lt;/b&gt;");
  });

  test("anchor", () => {
    const a: Anchor = ["a", "click me", "https://example.com"];
    expect(renderInline(a)).toBe('<a href="https://example.com">click me</a>');
  });

  test("anchor escapes href and text", () => {
    const a: Anchor = ["a", "<b>x</b>", 'https://x.com?a=1&b="2"'];
    expect(renderInline(a)).toBe(
      '<a href="https://x.com?a=1&amp;b=&quot;2&quot;">&lt;b&gt;x&lt;/b&gt;</a>',
    );
  });

  test("inline code", () => {
    const c: Code = ["c", "x = 1"];
    expect(renderInline(c)).toBe("<code>x = 1</code>");
  });

  test("bold", () => {
    const b: Bold = ["b", "important"];
    expect(renderInline(b)).toBe("<strong>important</strong>");
  });

  test("italic", () => {
    const i: Italic = ["i", "soft"];
    expect(renderInline(i)).toBe("<em>soft</em>");
  });

  test("custom anchor renderer", () => {
    const a: Anchor = ["a", "click", "https://example.com"];
    const result = renderInline(a, {
      inlines: { a: ([, text, href]) => `<a class="custom" href="${href}">${text}</a>` },
    });
    expect(result).toBe('<a class="custom" href="https://example.com">click</a>');
  });
});

describe("renderInlines", () => {
  test("concatenates inlines", () => {
    const bold: Bold = ["b", "world"];
    expect(renderInlines(["hello ", bold])).toBe("hello <strong>world</strong>");
  });
});

describe("renderBlock", () => {
  test("paragraph", () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    expect(renderBlock(p)).toBe("<p>hello</p>");
  });

  test("paragraph with inline formatting", () => {
    const b: Bold = ["b", "bold"];
    const p: ParagraphBlock = ["p", ["text ", b]];
    expect(renderBlock(p)).toBe("<p>text <strong>bold</strong></p>");
  });

  test("h1", () => {
    const h: Heading1Block = ["1", ["Title"]];
    expect(renderBlock(h)).toBe("<h1>Title</h1>");
  });

  test("h2", () => {
    const h: Heading2Block = ["2", ["Subtitle"]];
    expect(renderBlock(h)).toBe("<h2>Subtitle</h2>");
  });

  test("h3", () => {
    const h: Heading3Block = ["3", ["Section"]];
    expect(renderBlock(h)).toBe("<h3>Section</h3>");
  });

  test("blockquote with text", () => {
    const q: QuoteBlock = ["q", ["quoted"]];
    expect(renderBlock(q)).toBe("<blockquote>quoted</blockquote>");
  });

  test("blockquote with nested paragraph", () => {
    const inner: ParagraphBlock = ["p", ["nested"]];
    const q: QuoteBlock = ["q", [inner]];
    expect(renderBlock(q)).toBe("<blockquote><p>nested</p></blockquote>");
  });

  test("code block with lang", () => {
    const c: CodeBlock = ["c", "typescript", "const x = 1;"];
    expect(renderBlock(c)).toBe('<pre><code class="language-typescript">const x = 1;</code></pre>');
  });

  test("code block without lang", () => {
    const c: CodeBlock = ["c", "", "hello"];
    expect(renderBlock(c)).toBe("<pre><code>hello</code></pre>");
  });

  test("code block escapes content", () => {
    const c: CodeBlock = ["c", "html", "<div>hi</div>"];
    expect(renderBlock(c)).toBe(
      '<pre><code class="language-html">&lt;div&gt;hi&lt;/div&gt;</code></pre>',
    );
  });

  test("unordered list", () => {
    const ul: UnorderedListBlock = ["u", ["item 1"], ["item 2"]];
    expect(renderBlock(ul)).toBe("<ul><li>item 1</li><li>item 2</li></ul>");
  });

  test("ordered list", () => {
    const ol: OrderedListBlock = ["o", ["first"], ["second"]];
    expect(renderBlock(ol)).toBe("<ol><li>first</li><li>second</li></ol>");
  });

  test("table with header", () => {
    const t: TableBlock = [
      "t",
      true,
      [
        [["Name"], ["Age"]],
        [["Alice"], ["30"]],
      ],
    ];
    expect(renderBlock(t)).toBe(
      "<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>",
    );
  });

  test("table without header", () => {
    const t: TableBlock = ["t", false, [[["a"], ["b"]]]];
    expect(renderBlock(t)).toBe("<table><tr><td>a</td><td>b</td></tr></table>");
  });

  test("image with default baseUrl", () => {
    const img: ImageBlock = ["i", "abc123def456ghij.png", "A photo"];
    expect(renderBlock(img)).toBe('<img src="/files/abc123def456ghij.png" alt="A photo">');
  });

  test("image with custom baseUrl", () => {
    const img: ImageBlock = ["i", "abc123def456ghij.png", "A photo"];
    expect(renderBlock(img, { file: { baseUrl: "https://cdn.example.com/f" } })).toBe(
      '<img src="https://cdn.example.com/f/abc123def456ghij.png" alt="A photo">',
    );
  });

  test("image with custom baseUrl strips trailing slash", () => {
    const img: ImageBlock = ["i", "abc123def456ghij.png", "A photo"];
    expect(renderBlock(img, { file: { baseUrl: "/assets/" } })).toBe(
      '<img src="/assets/abc123def456ghij.png" alt="A photo">',
    );
  });

  test("image with imgExt override", () => {
    const img: ImageBlock = ["i", "abc123def456ghij.png", "A photo"];
    expect(renderBlock(img, { file: { imgExt: "avif" } })).toBe(
      '<img src="/files/abc123def456ghij.avif" alt="A photo">',
    );
  });

  test("image with fileUrl escape hatch", () => {
    const img: ImageBlock = ["i", "abc.png", "x"];
    const result = renderBlock(img, {
      file: {
        fileUrl: ({ id, ext, mediaType }) => `https://cdn/${mediaType}/${id}.${ext}`,
      },
    });
    expect(result).toBe('<img src="https://cdn/image/abc.png" alt="x">');
  });

  test("custom block renders children", () => {
    const inner: ParagraphBlock = ["p", ["child"]];
    const custom: CustomBlock = ["x", "MyWidget", { color: "red" }, [inner]];
    expect(renderBlock(custom)).toBe("<p>child</p>");
  });

  test("custom block override", () => {
    const inner: ParagraphBlock = ["p", ["child"]];
    const custom: CustomBlock = ["x", "MyWidget", { color: "red" }, [inner]];
    const result = renderBlock(custom, {
      blocks: {
        custom: (b, ctx) => `<div data-widget="${b[1]}">${ctx.renderBlock(b[3][0])}</div>`,
      },
    });
    expect(result).toBe('<div data-widget="MyWidget"><p>child</p></div>');
  });

  test("paragraph custom renderer", () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    const result = renderBlock(p, {
      blocks: { p: (_, ctx) => `<p class="lead">${ctx.renderInlines(_[1])}</p>` },
    });
    expect(result).toBe('<p class="lead">hello</p>');
  });
});

describe("renderBlocks", () => {
  test("renders multiple blocks", () => {
    const blocks: Block[] = [
      ["1", ["Title"]],
      ["p", ["Body"]],
    ];
    expect(renderBlocks(blocks)).toBe("<h1>Title</h1><p>Body</p>");
  });

  test("empty array", () => {
    expect(renderBlocks([])).toBe("");
  });
});

describe("buildFileUrl", () => {
  test("default baseUrl", () => {
    expect(buildFileUrl("abc.png")).toBe("/files/abc.png");
  });

  test("custom baseUrl", () => {
    expect(buildFileUrl("abc.png", { baseUrl: "https://cdn.example.com" })).toBe(
      "https://cdn.example.com/abc.png",
    );
  });

  test("strips trailing slash on baseUrl", () => {
    expect(buildFileUrl("abc.png", { baseUrl: "/assets/" })).toBe("/assets/abc.png");
  });

  test("imgExt override applies only when mediaType=image", () => {
    expect(buildFileUrl("abc.png", { imgExt: "avif" }, "image")).toBe("/files/abc.avif");
    expect(buildFileUrl("abc.png", { imgExt: "avif" }, "video")).toBe("/files/abc.png");
    expect(buildFileUrl("abc.png", { imgExt: "avif" })).toBe("/files/abc.png");
  });

  test("videoExt override", () => {
    expect(buildFileUrl("abc.mov", { videoExt: "mp4" }, "video")).toBe("/files/abc.mp4");
  });

  test("fileUrl escape hatch receives mediaType when provided", () => {
    const fileUrl = ({ id, ext, mediaType }: { id: string; ext: string; mediaType?: string }) =>
      `cdn/${mediaType ?? "any"}/${id}.${ext}`;
    expect(buildFileUrl("abc.png", { fileUrl }, "image")).toBe("cdn/image/abc.png");
    expect(buildFileUrl("abc.bin", { fileUrl })).toBe("cdn/any/abc.bin");
  });

  test("throws on malformed canonical", () => {
    expect(() => buildFileUrl("abc")).toThrow("invalid canonical");
    expect(() => buildFileUrl("abc.")).toThrow("invalid canonical");
    expect(() => buildFileUrl(".png")).toThrow("invalid canonical");
  });

  test("preserves id containing dots (splits on last dot)", () => {
    expect(buildFileUrl("a.b.c.png")).toBe("/files/a.b.c.png");
  });
});
