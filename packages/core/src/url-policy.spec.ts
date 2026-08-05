import { describe, expect, test } from "bun:test";
import { renderInline } from "./render";
import { renderInlineMarkdown } from "./markdown";
import { isSafeUrl, SAFE_URL_SCHEMES } from "./url-policy";
import type { Anchor } from "./blocks";

describe("isSafeUrl", () => {
  test("allows relative references", () => {
    for (const href of [
      "",
      "/docs",
      "./docs",
      "../docs",
      "?tab=all",
      "#details",
      "//cdn.example.com/file",
    ]) {
      expect(isSafeUrl(href)).toBe(true);
    }
  });

  test("allows HTTP(S) and explicitly supported schemes", () => {
    for (const scheme of SAFE_URL_SCHEMES) {
      expect(isSafeUrl(`${scheme}:example-value`)).toBe(true);
      expect(isSafeUrl(`${scheme.toUpperCase()}:example-value`)).toBe(true);
    }
  });

  test("rejects unknown schemes", () => {
    for (const href of [
      "data:text/html,<script>",
      "vbscript:msgbox(1)",
      "blob:https://example.com/id",
      "gopher://example.com",
    ]) {
      expect(isSafeUrl(href)).toBe(false);
    }
  });

  test("rejects mixed-case and whitespace/control-obfuscated executable schemes", () => {
    for (const href of [
      "JaVaScRiPt:alert(1)",
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "java\rscript:alert(1)",
      "java\u0000script:alert(1)",
      "j a v a s c r i p t:alert(1)",
      " \tjavascript:alert(1)",
    ]) {
      expect(isSafeUrl(href)).toBe(false);
    }
  });
});

describe("default rich-content URL policy", () => {
  const hostile: Anchor = ["a", "<Hostile & link>", "Ja\tvaScript:alert(1)"];
  const valid: Anchor = ["a", "Read docs", "/docs?tab=all#details"];

  test("HTML renders rejected anchors as escaped plain text", () => {
    expect(renderInline(hostile)).toBe("&lt;Hostile &amp; link&gt;");
    expect(renderInline(valid)).toBe('<a href="/docs?tab=all#details">Read docs</a>');
  });

  test("Markdown renders rejected anchors as escaped plain text", () => {
    expect(renderInlineMarkdown(hostile)).toBe("<Hostile & link>");
    expect(renderInlineMarkdown(valid)).toBe("[Read docs](/docs?tab=all#details)");
  });

  test("custom HTML anchor renderers receive the original anchor", () => {
    expect(
      renderInline(hostile, {
        inlines: { a: (inline) => `<custom>${inline[2]}</custom>` },
      }),
    ).toBe("<custom>Ja\tvaScript:alert(1)</custom>");
  });

  test("custom Markdown anchor renderers receive the original anchor", () => {
    expect(
      renderInlineMarkdown(hostile, {
        inlines: { a: (inline) => `<custom>${inline[2]}</custom>` },
      }),
    ).toBe("<custom>Ja\tvaScript:alert(1)</custom>");
  });
});
