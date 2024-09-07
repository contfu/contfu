export type QuoteBlock = [type: "q", text: (Text | Block)[]];
export type ParagraphBlock = [type: "p", text: Text[]];
export type CodeBlock = [type: "c", lang: string, text: string];
export type Heading1Block = [type: "1", text: Text[]];
export type Heading2Block = [type: "2", text: Text[]];
export type Heading3Block = [type: "3", text: Text[]];
export type UnorderedListBlock = [type: "u", items: (Text | Block)[]];
export type OrderedListBlock = [type: "o", items: (Text | Block)[]];
export type TableBlock = [
  type: "t",
  hasHeader: boolean,
  cells: (Block | Text)[][][]
];
export type ImageBlock = [
  type: "i",
  canonical: string,
  alt: string,
  widths: number[]
];
export type CustomBlock = [
  type: "x",
  name: string,
  props: Record<string, any>,
  children: Block[]
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

export type Text = Anchor | Code | Bold | Italic | string;

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

export function isA(text?: Text | null): text is Anchor {
  return text?.[0] === "a";
}
export function isC(text?: Text | null): text is Code {
  return text?.[0] === "c";
}
export function isB(text?: Text | null): text is Bold {
  return text?.[0] === "b";
}
export function isI(text?: Text | null): text is Italic {
  return text?.[0] === "i";
}
export function isString(text?: Text | null): text is string {
  return typeof text === "string";
}

export function toPlainText(texts: Text[]) {
  return texts.map((t) => (isString(t) ? t : t[1])).join(" ");
}

export function getText(block: Block): Text[] {
  if (isCustom(block)) {
    return (block.slice(3) as Block[]).flatMap(getText);
  }
  if (
    isQuote(block) ||
    isP(block) ||
    isH1(block) ||
    isH2(block) ||
    isH3(block)
  ) {
    return block[1].flat();
  }
  return [];
}
