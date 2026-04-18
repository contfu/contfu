import { describe, expect, test } from "bun:test";
import type { Block as BlockType, Heading1Block, ImageBlock, ParagraphBlock } from "@contfu/core";
import { BlockComponent } from "./block.component";
import { BlocksComponent } from "./blocks.component";

describe("BlockComponent (Angular)", () => {
  test("renders paragraph", () => {
    const c = new BlockComponent(null);
    c.block = ["p", ["hello"]] as ParagraphBlock;
    c.ngOnChanges();
    expect(c.html).toBe("<p>hello</p>");
  });

  test("renders image with default baseUrl", () => {
    const c = new BlockComponent(null);
    c.block = ["i", "abc.png", "alt text"] as ImageBlock;
    c.ngOnChanges();
    expect(c.html).toBe('<img src="/files/abc.png" alt="alt text">');
  });

  test("renders image with file prop", () => {
    const c = new BlockComponent(null);
    c.block = ["i", "abc.png", "alt"] as ImageBlock;
    c.file = { baseUrl: "/assets" };
    c.ngOnChanges();
    expect(c.html).toBe('<img src="/assets/abc.png" alt="alt">');
  });

  test("renders image with injected CONTFU_FILE_URL", () => {
    const c = new BlockComponent({ baseUrl: "/ctx" });
    c.block = ["i", "abc.png", "alt"] as ImageBlock;
    c.ngOnChanges();
    expect(c.html).toBe('<img src="/ctx/abc.png" alt="alt">');
  });

  test("image: prop beats injected token", () => {
    const c = new BlockComponent({ baseUrl: "/ctx" });
    c.block = ["i", "abc.png", "alt"] as ImageBlock;
    c.file = { baseUrl: "/prop" };
    c.ngOnChanges();
    expect(c.html).toBe('<img src="/prop/abc.png" alt="alt">');
  });

  test("renders image with imgExt override", () => {
    const c = new BlockComponent(null);
    c.block = ["i", "abc.png", "x"] as ImageBlock;
    c.file = { imgExt: "avif" };
    c.ngOnChanges();
    expect(c.html).toBe('<img src="/files/abc.avif" alt="x">');
  });
});

describe("BlocksComponent (Angular)", () => {
  test("renders list of blocks", () => {
    const c = new BlocksComponent(null);
    c.blocks = [
      ["1", ["Title"]] as Heading1Block,
      ["p", ["Body"]] as ParagraphBlock,
    ] as BlockType[];
    c.ngOnChanges();
    expect(c.html).toBe("<h1>Title</h1><p>Body</p>");
  });

  test("empty array", () => {
    const c = new BlocksComponent(null);
    c.blocks = [];
    c.ngOnChanges();
    expect(c.html).toBe("");
  });
});
