import React from "react";
import {
  buildFileUrl,
  isP,
  isH1,
  isH2,
  isH3,
  isQuote,
  isCode,
  isUl,
  isOl,
  isTable,
  isImg,
  isCustom,
  isAnchor,
  isMonospace,
  isBold,
  isItalic,
  isString,
  isInline,
  type Block,
  type Inline,
  type FileUrlOptions,
  type ParagraphBlock,
  type Heading1Block,
  type Heading2Block,
  type Heading3Block,
  type QuoteBlock,
  type CodeBlock,
  type UnorderedListBlock,
  type OrderedListBlock,
  type TableBlock,
  type ImageBlock,
  type CustomBlock,
} from "@contfu/core";

export const FileUrlContext = React.createContext<FileUrlOptions | undefined>(undefined);

export type BlockComponents = {
  p?: React.ComponentType<{ block: ParagraphBlock; children: React.ReactNode }>;
  h1?: React.ComponentType<{ block: Heading1Block; children: React.ReactNode }>;
  h2?: React.ComponentType<{ block: Heading2Block; children: React.ReactNode }>;
  h3?: React.ComponentType<{ block: Heading3Block; children: React.ReactNode }>;
  blockquote?: React.ComponentType<{ block: QuoteBlock; children: React.ReactNode }>;
  pre?: React.ComponentType<{ block: CodeBlock }>;
  ul?: React.ComponentType<{ block: UnorderedListBlock; children: React.ReactNode }>;
  ol?: React.ComponentType<{ block: OrderedListBlock; children: React.ReactNode }>;
  table?: React.ComponentType<{ block: TableBlock; children: React.ReactNode }>;
  img?: React.ComponentType<{ block: ImageBlock }>;
  custom?: React.ComponentType<{ block: CustomBlock; children: React.ReactNode }>;
};

interface InlineProps {
  inline: Inline;
}

function InlineNode({ inline }: InlineProps): React.ReactNode {
  if (isString(inline)) return inline;
  if (isAnchor(inline)) {
    const [, text, href] = inline;
    return <a href={href}>{text}</a>;
  }
  if (isMonospace(inline)) {
    const [, text] = inline;
    return <code>{text}</code>;
  }
  if (isBold(inline)) {
    const [, text] = inline;
    return <strong>{text}</strong>;
  }
  if (isItalic(inline)) {
    const [, text] = inline;
    return <em>{text}</em>;
  }
  return null;
}

function InlineNodes({ inlines }: { inlines: Inline[] }): React.ReactNode {
  return (
    <>
      {inlines.map((inline, i) => (
        <InlineNode key={i} inline={inline} />
      ))}
    </>
  );
}

interface BlockNodeProps {
  block: Block;
  components?: BlockComponents;
}

function BlockNode({ block, components }: BlockNodeProps): React.ReactNode {
  const fileCtx = React.useContext(FileUrlContext);
  if (isP(block)) {
    const P = components?.p;
    const children = <InlineNodes inlines={block[1]} />;
    return P ? <P block={block}>{children}</P> : <p>{children}</p>;
  }
  if (isH1(block)) {
    const H1 = components?.h1;
    const children = <InlineNodes inlines={block[1]} />;
    return H1 ? <H1 block={block}>{children}</H1> : <h1>{children}</h1>;
  }
  if (isH2(block)) {
    const H2 = components?.h2;
    const children = <InlineNodes inlines={block[1]} />;
    return H2 ? <H2 block={block}>{children}</H2> : <h2>{children}</h2>;
  }
  if (isH3(block)) {
    const H3 = components?.h3;
    const children = <InlineNodes inlines={block[1]} />;
    return H3 ? <H3 block={block}>{children}</H3> : <h3>{children}</h3>;
  }
  if (isQuote(block)) {
    const Blockquote = components?.blockquote;
    const children = block[1].map((c, i) =>
      isInline(c) ? (
        <InlineNode key={i} inline={c} />
      ) : (
        <BlockNode key={i} block={c} components={components} />
      ),
    );
    return Blockquote ? (
      <Blockquote block={block}>{children}</Blockquote>
    ) : (
      <blockquote>{children}</blockquote>
    );
  }
  if (isCode(block)) {
    const Pre = components?.pre;
    if (Pre) return <Pre block={block} />;
    const [, lang, text] = block;
    return (
      <pre>
        <code className={lang ? `language-${lang}` : undefined}>{text}</code>
      </pre>
    );
  }
  if (isUl(block)) {
    const Ul = components?.ul;
    const items = block.slice(1) as (Inline | Block)[][];
    const children = items.map((item, i) => (
      <li key={i}>
        {item.map((c, j) =>
          isInline(c) ? (
            <InlineNode key={j} inline={c} />
          ) : (
            <BlockNode key={j} block={c} components={components} />
          ),
        )}
      </li>
    ));
    return Ul ? <Ul block={block}>{children}</Ul> : <ul>{children}</ul>;
  }
  if (isOl(block)) {
    const Ol = components?.ol;
    const items = block.slice(1) as (Inline | Block)[][];
    const children = items.map((item, i) => (
      <li key={i}>
        {item.map((c, j) =>
          isInline(c) ? (
            <InlineNode key={j} inline={c} />
          ) : (
            <BlockNode key={j} block={c} components={components} />
          ),
        )}
      </li>
    ));
    return Ol ? <Ol block={block}>{children}</Ol> : <ol>{children}</ol>;
  }
  if (isTable(block)) {
    const Table = components?.table;
    const [, hasHeader, rows] = block;
    const children = rows.map((row, ri) => (
      <tr key={ri}>
        {row.map((cell, ci) => {
          const Tag = hasHeader && ri === 0 ? "th" : "td";
          return (
            <Tag key={ci}>
              {cell.map((c, k) =>
                isInline(c) ? (
                  <InlineNode key={k} inline={c} />
                ) : (
                  <BlockNode key={k} block={c} components={components} />
                ),
              )}
            </Tag>
          );
        })}
      </tr>
    ));
    return Table ? <Table block={block}>{children}</Table> : <table>{children}</table>;
  }
  if (isImg(block)) {
    const Img = components?.img;
    if (Img) return <Img block={block} />;
    const [, canonical, alt] = block;
    return <img src={buildFileUrl(canonical, fileCtx, "image")} alt={alt} />;
  }
  if (isCustom(block)) {
    const Custom = components?.custom;
    const childBlocks = block[3] as Block[];
    const children = childBlocks.map((c, i) => (
      <BlockNode key={i} block={c} components={components} />
    ));
    return Custom ? <Custom block={block}>{children}</Custom> : <>{children}</>;
  }
  return null;
}

export interface BlocksProps {
  blocks: Block[];
  components?: BlockComponents;
  file?: FileUrlOptions;
}

export function Blocks({ blocks, components, file }: BlocksProps): React.ReactNode {
  const nodes = (
    <>
      {blocks.map((block, i) => (
        <BlockNode key={i} block={block} components={components} />
      ))}
    </>
  );
  return file ? <FileUrlContext.Provider value={file}>{nodes}</FileUrlContext.Provider> : nodes;
}

export interface BlockProps {
  block: Block;
  components?: BlockComponents;
  file?: FileUrlOptions;
}

export function Block({ block, components, file }: BlockProps): React.ReactNode {
  const node = <BlockNode block={block} components={components} />;
  return file ? <FileUrlContext.Provider value={file}>{node}</FileUrlContext.Provider> : node;
}
