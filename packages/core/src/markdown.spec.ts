import { describe, expect, test } from "bun:test";
import {
  renderBlockMarkdown,
  renderBlocksMarkdown,
  renderInlineMarkdown,
  renderInlinesMarkdown,
} from "./markdown";
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

describe("renderInlineMarkdown", () => {
  test("plain string", () => {
    expect(renderInlineMarkdown("hello")).toBe("hello");
  });

  test("escapes markdown special chars", () => {
    expect(renderInlineMarkdown("a *bold* [link]")).toBe("a \\*bold\\* \\[link\\]");
  });

  test("anchor", () => {
    const a: Anchor = ["a", "click me", "https://example.com"];
    expect(renderInlineMarkdown(a)).toBe("[click me](https://example.com)");
  });

  test("inline code (not escaped)", () => {
    const c: Code = ["c", "x = 1"];
    expect(renderInlineMarkdown(c)).toBe("`x = 1`");
  });

  test("bold", () => {
    const b: Bold = ["b", "important"];
    expect(renderInlineMarkdown(b)).toBe("**important**");
  });

  test("italic", () => {
    const i: Italic = ["i", "soft"];
    expect(renderInlineMarkdown(i)).toBe("*soft*");
  });
});

describe("renderInlinesMarkdown", () => {
  test("concatenates inlines", () => {
    const bold: Bold = ["b", "world"];
    expect(renderInlinesMarkdown(["hello ", bold])).toBe("hello **world**");
  });
});

describe("renderBlockMarkdown", () => {
  test("paragraph", () => {
    const p: ParagraphBlock = ["p", ["hello"]];
    expect(renderBlockMarkdown(p)).toBe("hello\n\n");
  });

  test("h1", () => {
    const h: Heading1Block = ["1", ["Title"]];
    expect(renderBlockMarkdown(h)).toBe("# Title\n\n");
  });

  test("h2", () => {
    const h: Heading2Block = ["2", ["Sub"]];
    expect(renderBlockMarkdown(h)).toBe("## Sub\n\n");
  });

  test("h3", () => {
    const h: Heading3Block = ["3", ["Section"]];
    expect(renderBlockMarkdown(h)).toBe("### Section\n\n");
  });

  test("blockquote", () => {
    const q: QuoteBlock = ["q", ["quoted text"]];
    expect(renderBlockMarkdown(q)).toBe("> quoted text\n\n");
  });

  test("code block", () => {
    const c: CodeBlock = ["c", "typescript", "const x = 1;"];
    expect(renderBlockMarkdown(c)).toBe("```typescript\nconst x = 1;\n```\n\n");
  });

  test("code block without lang", () => {
    const c: CodeBlock = ["c", "", "hello"];
    expect(renderBlockMarkdown(c)).toBe("```\nhello\n```\n\n");
  });

  test("unordered list", () => {
    const ul: UnorderedListBlock = ["u", ["item 1"], ["item 2"]];
    expect(renderBlockMarkdown(ul)).toBe("- item 1\n- item 2\n\n");
  });

  test("ordered list", () => {
    const ol: OrderedListBlock = ["o", ["first"], ["second"]];
    expect(renderBlockMarkdown(ol)).toBe("1. first\n2. second\n\n");
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
    expect(renderBlockMarkdown(t)).toBe("| Name | Age |\n| --- | --- |\n| Alice | 30 |\n\n");
  });

  test("table without header", () => {
    const t: TableBlock = ["t", false, [[["a"], ["b"]]]];
    expect(renderBlockMarkdown(t)).toBe("| a | b |\n\n");
  });

  test("image", () => {
    const img: ImageBlock = ["i", "https://example.com/img.jpg", "A photo"];
    expect(renderBlockMarkdown(img)).toBe("![A photo](https://example.com/img.jpg)\n\n");
  });

  test("custom block renders children", () => {
    const inner: ParagraphBlock = ["p", ["child"]];
    const custom: CustomBlock = ["x", "Widget", {}, [inner]];
    expect(renderBlockMarkdown(custom)).toBe("child\n\n");
  });
});

describe("renderBlocksMarkdown", () => {
  test("renders multiple blocks trimmed", () => {
    const blocks: Block[] = [
      ["1", ["Title"]],
      ["p", ["Body"]],
    ];
    expect(renderBlocksMarkdown(blocks)).toBe("# Title\n\nBody");
  });

  test("empty array", () => {
    expect(renderBlocksMarkdown([])).toBe("");
  });
});
