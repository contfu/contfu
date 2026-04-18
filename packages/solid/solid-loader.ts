import { createComponent } from "solid-js";

type SSRNode = { t: string };
type Child = string | SSRNode | null | undefined | boolean;
type AnyFn = (...a: unknown[]) => unknown;

function childStr(c: Child | Child[]): string {
  if (Array.isArray(c)) return c.map(childStr).join("");
  if (c == null || c === true || c === false) return "";
  if (typeof c === "object") return c.t;
  return String(c);
}

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function jsx(tag: string, props: Record<string, unknown>): SSRNode {
  const { children, ...rest } = props ?? {};
  const attrs = Object.entries(rest)
    .map(([k, v]) => {
      if (v === true) return k;
      if (v == null || v === false) return null;
      const name = k === "className" ? "class" : k === "htmlFor" ? "for" : k;
      return `${name}="${escapeAttr(String(v))}"`;
    })
    .filter(Boolean)
    .join(" ");
  const open = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
  if (VOID.has(tag)) return { t: attrs ? `<${tag} ${attrs}>` : `<${tag}>` };
  return { t: `${open}${childStr(children as Child | Child[])}</${tag}>` };
}

const Fragment = Symbol("Fragment");

function createElement(
  tag: string | AnyFn | symbol,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  const merged: Record<string, unknown> = props ? { ...props } : {};
  if (children.length === 1) merged.children = children[0];
  else if (children.length > 1) merged.children = children;
  if (tag === Fragment || tag == null) return merged.children ?? "";
  if (typeof tag === "function") {
    return createComponent(tag as Parameters<typeof createComponent>[0], merged);
  }
  return jsx(tag as string, merged);
}

(globalThis as unknown as Record<string, unknown>).React = { createElement, Fragment };
