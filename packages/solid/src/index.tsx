import { For, Switch, Match, createContext, useContext, type Component, type JSX } from "solid-js";
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
  type FileUrlOptions,
  type Inline,
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

export const FileUrlContext = createContext<FileUrlOptions | undefined>(undefined);

export type BlockComponents = {
  p?: Component<{ block: ParagraphBlock; children?: JSX.Element }>;
  h1?: Component<{ block: Heading1Block; children?: JSX.Element }>;
  h2?: Component<{ block: Heading2Block; children?: JSX.Element }>;
  h3?: Component<{ block: Heading3Block; children?: JSX.Element }>;
  blockquote?: Component<{ block: QuoteBlock; children?: JSX.Element }>;
  pre?: Component<{ block: CodeBlock }>;
  ul?: Component<{ block: UnorderedListBlock; children?: JSX.Element }>;
  ol?: Component<{ block: OrderedListBlock; children?: JSX.Element }>;
  table?: Component<{ block: TableBlock; children?: JSX.Element }>;
  img?: Component<{ block: ImageBlock }>;
  custom?: Component<{ block: CustomBlock; children?: JSX.Element }>;
};

function InlineNode(props: { inline: Inline }): JSX.Element {
  const { inline } = props;
  if (isString(inline)) return inline as unknown as JSX.Element;
  if (isAnchor(inline)) return <a href={inline[2]}>{inline[1]}</a>;
  if (isMonospace(inline)) return <code>{inline[1]}</code>;
  if (isBold(inline)) return <strong>{inline[1]}</strong>;
  if (isItalic(inline)) return <em>{inline[1]}</em>;
  return null as unknown as JSX.Element;
}

function InlineNodes(props: { inlines: Inline[] }): JSX.Element {
  return <For each={props.inlines}>{(inline) => <InlineNode inline={inline} />}</For>;
}

interface BlockNodeProps {
  block: Block;
  components?: BlockComponents;
  file?: FileUrlOptions;
}

function BlockNode(props: BlockNodeProps): JSX.Element {
  const { block, components = {} } = props;
  const file = props.file ?? useContext(FileUrlContext);

  return (
    <Switch>
      <Match when={isP(block) && block}>
        {(b) => {
          const P = components.p;
          const children = <InlineNodes inlines={(b() as ParagraphBlock)[1]} />;
          return P ? <P block={b() as ParagraphBlock}>{children}</P> : <p>{children}</p>;
        }}
      </Match>
      <Match when={isH1(block) && block}>
        {(b) => {
          const H1 = components.h1;
          const children = <InlineNodes inlines={(b() as Heading1Block)[1]} />;
          return H1 ? <H1 block={b() as Heading1Block}>{children}</H1> : <h1>{children}</h1>;
        }}
      </Match>
      <Match when={isH2(block) && block}>
        {(b) => {
          const H2 = components.h2;
          const children = <InlineNodes inlines={(b() as Heading2Block)[1]} />;
          return H2 ? <H2 block={b() as Heading2Block}>{children}</H2> : <h2>{children}</h2>;
        }}
      </Match>
      <Match when={isH3(block) && block}>
        {(b) => {
          const H3 = components.h3;
          const children = <InlineNodes inlines={(b() as Heading3Block)[1]} />;
          return H3 ? <H3 block={b() as Heading3Block}>{children}</H3> : <h3>{children}</h3>;
        }}
      </Match>
      <Match when={isQuote(block) && block}>
        {(b) => {
          const Blockquote = components.blockquote;
          const children = (
            <For each={(b() as QuoteBlock)[1]}>
              {(c) =>
                isInline(c) ? (
                  <InlineNode inline={c} />
                ) : (
                  <BlockNode block={c} components={components} file={file} />
                )
              }
            </For>
          );
          return Blockquote ? (
            <Blockquote block={b() as QuoteBlock}>{children}</Blockquote>
          ) : (
            <blockquote>{children}</blockquote>
          );
        }}
      </Match>
      <Match when={isCode(block) && block}>
        {(b) => {
          const Pre = components.pre;
          if (Pre) return <Pre block={b() as CodeBlock} />;
          const [, lang, text] = b() as CodeBlock;
          return (
            <pre>
              <code class={lang ? `language-${lang}` : undefined}>{text}</code>
            </pre>
          );
        }}
      </Match>
      <Match when={isUl(block) && block}>
        {(b) => {
          const Ul = components.ul;
          const items = (b() as UnorderedListBlock).slice(1) as (Inline | Block)[][];
          const children = (
            <For each={items}>
              {(item) => (
                <li>
                  <For each={item}>
                    {(c) =>
                      isInline(c) ? (
                        <InlineNode inline={c} />
                      ) : (
                        <BlockNode block={c} components={components} file={file} />
                      )
                    }
                  </For>
                </li>
              )}
            </For>
          );
          return Ul ? <Ul block={b() as UnorderedListBlock}>{children}</Ul> : <ul>{children}</ul>;
        }}
      </Match>
      <Match when={isOl(block) && block}>
        {(b) => {
          const Ol = components.ol;
          const items = (b() as OrderedListBlock).slice(1) as (Inline | Block)[][];
          const children = (
            <For each={items}>
              {(item) => (
                <li>
                  <For each={item}>
                    {(c) =>
                      isInline(c) ? (
                        <InlineNode inline={c} />
                      ) : (
                        <BlockNode block={c} components={components} file={file} />
                      )
                    }
                  </For>
                </li>
              )}
            </For>
          );
          return Ol ? <Ol block={b() as OrderedListBlock}>{children}</Ol> : <ol>{children}</ol>;
        }}
      </Match>
      <Match when={isTable(block) && block}>
        {(b) => {
          const Table = components.table;
          const [, hasHeader, rows] = b() as TableBlock;
          const children = (
            <For each={rows}>
              {(row, ri) => (
                <tr>
                  <For each={row}>
                    {(cell) => {
                      const Tag = hasHeader && ri() === 0 ? "th" : "td";
                      return (
                        <Tag>
                          <For each={cell}>
                            {(c) =>
                              isInline(c) ? (
                                <InlineNode inline={c} />
                              ) : (
                                <BlockNode block={c} components={components} file={file} />
                              )
                            }
                          </For>
                        </Tag>
                      );
                    }}
                  </For>
                </tr>
              )}
            </For>
          );
          return Table ? (
            <Table block={b() as TableBlock}>{children}</Table>
          ) : (
            <table>{children}</table>
          );
        }}
      </Match>
      <Match when={isImg(block) && block}>
        {(b) => {
          const Img = components.img;
          if (Img) return <Img block={b() as ImageBlock} />;
          const [, canonical, alt] = b() as ImageBlock;
          return <img src={buildFileUrl(canonical, file, "image")} alt={alt} />;
        }}
      </Match>
      <Match when={isCustom(block) && block}>
        {(b) => {
          const Custom = components.custom;
          const childBlocks = (b() as CustomBlock)[3] as Block[];
          const children = (
            <For each={childBlocks}>
              {(c) => <BlockNode block={c} components={components} file={file} />}
            </For>
          );
          if (Custom) return <Custom block={b() as CustomBlock}>{children}</Custom>;
          return children;
        }}
      </Match>
    </Switch>
  );
}

export interface BlocksProps {
  blocks: Block[];
  components?: BlockComponents;
  file?: FileUrlOptions;
}

export function Blocks(props: BlocksProps): JSX.Element {
  return (
    <FileUrlContext.Provider value={props.file}>
      <For each={props.blocks}>
        {(block) => <BlockNode block={block} components={props.components} file={props.file} />}
      </For>
    </FileUrlContext.Provider>
  );
}

export interface BlockProps {
  block: Block;
  components?: BlockComponents;
  file?: FileUrlOptions;
}

export function Block(props: BlockProps): JSX.Element {
  return (
    <FileUrlContext.Provider value={props.file}>
      <BlockNode block={props.block} components={props.components} file={props.file} />
    </FileUrlContext.Provider>
  );
}
