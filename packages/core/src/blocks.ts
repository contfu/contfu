export type QuoteBlock = [type: "q", text: (Inline | Block)[]];
export type ParagraphBlock = [type: "p", text: Inline[]];
export type CodeBlock = [type: "c", lang: string, text: string];
export type Heading1Block = [type: "1", text: Inline[]];
export type Heading2Block = [type: "2", text: Inline[]];
export type Heading3Block = [type: "3", text: Inline[]];
export type UnorderedListBlock = [type: "u", items: (Inline | Block)[]];
export type OrderedListBlock = [type: "o", items: (Inline | Block)[]];
export type TableBlock = [
  type: "t",
  hasHeader: boolean,
  cells: (Block | Inline)[][][],
];
export type ImageBlock = [
  type: "i",
  canonical: string,
  alt: string,
  widths: number[],
];
export type CustomBlock = [
  type: "x",
  name: string,
  props: Record<string, any>,
  children: Block[],
];

export type Block<T extends CustomBlock = CustomBlock> =
  | QuoteBlock
  | ParagraphBlock
  | CodeBlock
  | Heading1Block
  | Heading2Block
  | Heading3Block
  | UnorderedListBlock
  | OrderedListBlock
  | TableBlock
  | ImageBlock
  | T;

export type Anchor = [type: "a", text: string, href: string];
export type Code = [type: "c", text: string];
export type Bold = [type: "b", text: string];
export type Italic = [type: "i", text: string];

export type Inline = Anchor | Code | Bold | Italic | string;

export function isQuote(block?: Block | null): block is QuoteBlock {
  return block?.[0] === "q";
}
export function isP(block?: Block | null): block is ParagraphBlock {
  return block?.[0] === "p";
}
export function isCode(block?: Block | null): block is CodeBlock {
  return block?.[0] === "c";
}
export function isH1(block?: Block | null): block is Heading1Block {
  return block?.[0] === "1";
}
export function isH2(block?: Block | null): block is Heading2Block {
  return block?.[0] === "2";
}
export function isH3(block?: Block | null): block is Heading3Block {
  return block?.[0] === "3";
}
export function isUl(block?: Block | null): block is UnorderedListBlock {
  return block?.[0] === "u";
}
export function isOl(block?: Block | null): block is OrderedListBlock {
  return block?.[0] === "o";
}
export function isTable(block?: Block | null): block is TableBlock {
  return block?.[0] === "t";
}
export function isImg(block?: Block | null): block is ImageBlock {
  return block?.[0] === "i";
}
export function isCustom(block?: Block | null): block is CustomBlock {
  return block?.[0] === "x";
}

export function isAnchor(text?: Inline | null): text is Anchor {
  return text?.[0] === "a";
}
export function isMonospace(text?: Inline | null): text is Code {
  return text?.[0] === "m";
}
export function isBold(text?: Inline | null): text is Bold {
  return text?.[0] === "b";
}
export function isItalic(text?: Inline | null): text is Italic {
  return text?.[0] === "i";
}
export function isInline(x?: Inline | Block | null): x is Inline {
  const text = x as Inline;
  return (
    isString(text) ||
    isAnchor(text) ||
    isMonospace(text) ||
    isBold(text) ||
    isItalic(text)
  );
}
export function isString(text?: Inline | null): text is string {
  return typeof text === "string";
}

export function toPlainText(inlines: Inline[]) {
  return inlines.map((t) => (isString(t) ? t : t[1])).join(" ");
}

export function getText(block: Block): Inline[] {
  if (isCustom(block)) {
    return (block.slice(3) as Block[]).flatMap(getText);
  }
  if (isP(block) || isH1(block) || isH2(block) || isH3(block)) return block[1];
  if (isQuote(block)) return block[1].filter(isInline);
  return [];
}
