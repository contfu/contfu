import {
  h,
  defineComponent,
  inject,
  provide,
  type InjectionKey,
  type PropType,
  type VNode,
} from "vue";
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
  type Block as BlockType,
  type FileUrlOptions,
  type Inline,
} from "@contfu/core";

export type BlockComponents = {
  p?: ReturnType<typeof defineComponent>;
  h1?: ReturnType<typeof defineComponent>;
  h2?: ReturnType<typeof defineComponent>;
  h3?: ReturnType<typeof defineComponent>;
  blockquote?: ReturnType<typeof defineComponent>;
  pre?: ReturnType<typeof defineComponent>;
  ul?: ReturnType<typeof defineComponent>;
  ol?: ReturnType<typeof defineComponent>;
  table?: ReturnType<typeof defineComponent>;
  img?: ReturnType<typeof defineComponent>;
  custom?: ReturnType<typeof defineComponent>;
};

export const FILE_URL_INJECTION_KEY: InjectionKey<FileUrlOptions> = Symbol("@contfu/file");

function renderInlineNode(inline: Inline): VNode | string {
  if (isString(inline)) return inline;
  if (isAnchor(inline)) return h("a", { href: inline[2] }, inline[1]);
  if (isMonospace(inline)) return h("code", inline[1]);
  if (isBold(inline)) return h("strong", inline[1]);
  if (isItalic(inline)) return h("em", inline[1]);
  return "";
}

function renderInlineNodes(inlines: Inline[]): (VNode | string)[] {
  return inlines.map(renderInlineNode);
}

function renderBlockNode(
  block: BlockType,
  components: BlockComponents,
  file: FileUrlOptions | undefined,
): VNode | null {
  if (isP(block)) {
    const children = renderInlineNodes(block[1]);
    return components.p ? h(components.p, { block }, () => children) : h("p", children);
  }
  if (isH1(block)) {
    const children = renderInlineNodes(block[1]);
    return components.h1 ? h(components.h1, { block }, () => children) : h("h1", children);
  }
  if (isH2(block)) {
    const children = renderInlineNodes(block[1]);
    return components.h2 ? h(components.h2, { block }, () => children) : h("h2", children);
  }
  if (isH3(block)) {
    const children = renderInlineNodes(block[1]);
    return components.h3 ? h(components.h3, { block }, () => children) : h("h3", children);
  }
  if (isQuote(block)) {
    const children = block[1].map((c) =>
      isInline(c) ? renderInlineNode(c) : renderBlockNode(c, components, file),
    );
    return components.blockquote
      ? h(components.blockquote, { block }, () => children)
      : h("blockquote", children);
  }
  if (isCode(block)) {
    if (components.pre) return h(components.pre, { block });
    const [, lang, text] = block;
    return h("pre", h("code", { class: lang ? `language-${lang}` : undefined }, text));
  }
  if (isUl(block)) {
    const items = block.slice(1) as (Inline | BlockType)[][];
    const lis = items.map((item) =>
      h(
        "li",
        item.map((c) => (isInline(c) ? renderInlineNode(c) : renderBlockNode(c, components, file))),
      ),
    );
    return components.ul ? h(components.ul, { block }, () => lis) : h("ul", lis);
  }
  if (isOl(block)) {
    const items = block.slice(1) as (Inline | BlockType)[][];
    const lis = items.map((item) =>
      h(
        "li",
        item.map((c) => (isInline(c) ? renderInlineNode(c) : renderBlockNode(c, components, file))),
      ),
    );
    return components.ol ? h(components.ol, { block }, () => lis) : h("ol", lis);
  }
  if (isTable(block)) {
    const [, hasHeader, rows] = block;
    const trs = rows.map((row, ri) =>
      h(
        "tr",
        row.map((cell) => {
          const tag = hasHeader && ri === 0 ? "th" : "td";
          return h(
            tag,
            cell.map((c) =>
              isInline(c) ? renderInlineNode(c) : renderBlockNode(c, components, file),
            ),
          );
        }),
      ),
    );
    return components.table ? h(components.table, { block }, () => trs) : h("table", trs);
  }
  if (isImg(block)) {
    if (components.img) return h(components.img, { block });
    const [, canonical, alt] = block;
    return h("img", { src: buildFileUrl(canonical, file, "image"), alt });
  }
  if (isCustom(block)) {
    const children = (block[3] as BlockType[]).map((c) => renderBlockNode(c, components, file));
    return components.custom ? h(components.custom, { block }, () => children) : h(() => children);
  }
  return null;
}

export const Block = defineComponent({
  name: "ContfuBlock",
  props: {
    block: { type: Object as PropType<BlockType>, required: true },
    components: { type: Object as PropType<BlockComponents>, default: () => ({}) },
    file: { type: Object as PropType<FileUrlOptions>, default: undefined },
  },
  setup(props) {
    if (props.file) provide(FILE_URL_INJECTION_KEY, props.file);
    const injected = inject(FILE_URL_INJECTION_KEY, undefined);
    const resolved = props.file ?? injected;
    return () => renderBlockNode(props.block, props.components, resolved);
  },
});

export const Blocks = defineComponent({
  name: "ContfuBlocks",
  props: {
    blocks: { type: Array as PropType<BlockType[]>, required: true },
    components: { type: Object as PropType<BlockComponents>, default: () => ({}) },
    file: { type: Object as PropType<FileUrlOptions>, default: undefined },
  },
  setup(props) {
    if (props.file) provide(FILE_URL_INJECTION_KEY, props.file);
    const injected = inject(FILE_URL_INJECTION_KEY, undefined);
    const resolved = props.file ?? injected;
    return () => h(() => props.blocks.map((b) => renderBlockNode(b, props.components, resolved)));
  },
});
