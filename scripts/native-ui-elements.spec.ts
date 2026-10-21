import { describe, expect, it } from "bun:test";
import { checkNativeUiElements } from "./native-ui-elements";

const elements = (source: string) =>
  checkNativeUiElements(source).map((problem) => problem.element);

describe("native UI element policy", () => {
  it("flags native elements that have a shadcn component, at any depth", () => {
    expect(
      elements(`
        <input />
        {#if open}
          <div><select><option>a</option></select><label for="x">x</label></div>
        {/if}
        <button>b</button>
        <table><tbody><tr><td>c</td></tr></tbody></table>
        <dialog open></dialog>
        <textarea></textarea>
        <hr />
      `),
    ).toEqual([
      "input",
      "select",
      "label",
      "button",
      "table",
      "tbody",
      "tr",
      "td",
      "dialog",
      "textarea",
      "hr",
    ]);
  });

  it("reports the line of the element", () => {
    expect(checkNativeUiElements("<p>hi</p>\n\n<button>b</button>")).toMatchObject([
      { element: "button", line: 3 },
    ]);
  });

  it("ignores components, links and other elements", () => {
    expect(
      elements(`<script>import { Input } from "$lib/components/ui/input";</script>
        <Input /><a href="/">link</a><div><span>text</span></div>`),
    ).toEqual([]);
  });

  it("allows hidden inputs, static or through the form field helper", () => {
    expect(
      elements(`
        <input type="hidden" name="id" value="1" />
        <input {...field.as("hidden", value)} />
      `),
    ).toEqual([]);
    expect(
      elements(`
        <input type="text" />
        <input {...field.as("text", value)} />
        <input {...fields.name} />
        <input />
      `),
    ).toEqual(["input", "input", "input", "input"]);
  });

  it("allows an element with a native-ui-ok comment that has a reason", () => {
    expect(
      elements(`
        <!-- native-ui-ok: native color picker -->
        <input type="color" />
        <input type="color" />
      `),
    ).toEqual(["input"]);
  });

  it("rejects a native-ui-ok comment without a reason, or one that is not adjacent", () => {
    expect(elements("<!-- native-ui-ok: --><input />")).toEqual(["input"]);
    expect(elements("<!-- native-ui-ok: reason --><p>x</p><input />")).toEqual(["input"]);
  });
});
