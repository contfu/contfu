import type { Block, Inline } from "@contfu/core";
import type { ContentfulRichText, ContentfulRichTextNode } from "./contentful";

export function convertContentfulBlocks(richText: ContentfulRichText | undefined): Block[] {
  if (!richText || !richText.content || richText.content.length === 0) {
    return [];
  }

  const result: Block[] = [];

  for (const node of richText.content) {
    const converted = convertNode(node);
    if (converted) {
      result.push(converted);
    }
  }

  return result;
}

function convertNode(node: ContentfulRichTextNode): Block | null {
  switch (node.nodeType) {
    case "paragraph": {
      const inlines = extractInlines(node.content);
      if (inlines.length === 0) return null;
      return ["p", inlines];
    }

    case "heading-1": {
      const inlines = extractInlines(node.content);
      if (inlines.length === 0) return null;
      return ["1", inlines];
    }

    case "heading-2": {
      const inlines = extractInlines(node.content);
      if (inlines.length === 0) return null;
      return ["2", inlines];
    }

    case "heading-3":
    case "heading-4":
    case "heading-5":
    case "heading-6": {
      const inlines = extractInlines(node.content);
      if (inlines.length === 0) return null;
      return ["3", inlines];
    }

    case "unordered-list-item": {
      const inlines = extractInlines(node.content);
      if (inlines.length === 0) return null;
      return ["u", inlines];
    }

    case "ordered-list-item": {
      const inlines = extractInlines(node.content);
      if (inlines.length === 0) return null;
      return ["o", inlines];
    }

    case "blockquote": {
      const inlines = extractInlines(node.content);
      return ["q", inlines];
    }

    case "embedded-asset-block": {
      const data = node.data?.target as
        | { fields?: { file?: { "en-US"?: { url: string } } } }
        | undefined;
      const url = data?.fields?.file?.["en-US"]?.url;
      if (!url) return null;
      return ["i", url, "", []];
    }

    case "hr": {
      return ["c", "", ""];
    }

    default:
      return null;
  }
}

function extractInlines(content: ContentfulRichTextNode[] | undefined): Inline[] {
  if (!content) return [];

  return content.flatMap((node): Inline[] => {
    if (node.nodeType === "text") {
      const text = node.value?.trim() ?? "";
      if (text === "") return [];

      const marks = node.marks?.map((m) => m.type) ?? [];

      if (marks.includes("code")) return [["c", text]];
      if (marks.includes("bold")) return [["b", text]];
      if (marks.includes("italic")) return [["i", text]];

      return [text];
    }

    if (node.nodeType === "hyperlink") {
      const linkText = node.content?.map((c) => c.value ?? "").join("") ?? "";
      const uri = node.data?.uri as string | undefined;
      if (uri) {
        return [["a", linkText.trim(), uri]];
      }
      return [];
    }

    if (node.content) {
      return extractInlines(node.content);
    }

    return [];
  });
}

export function isContentfulRichText(value: unknown): value is ContentfulRichText {
  return (
    typeof value === "object" &&
    value !== null &&
    "nodeType" in value &&
    (value as ContentfulRichText).nodeType === "document"
  );
}
