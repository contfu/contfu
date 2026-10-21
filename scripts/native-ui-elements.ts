/**
 * Fails when an app template uses a native HTML element that has a shadcn-svelte component.
 *
 * oxlint only sees the `<script>` of `.svelte` files, so it cannot enforce this. This script
 * parses the templates with the Svelte compiler instead, like `svelte-each-keys.ts`.
 *
 * - Hidden inputs are always allowed: shadcn has no equivalent for form state. They are recognised
 *   by a static `type="hidden"` or by a spread of the form field helper `{...field.as("hidden", v)}`.
 * - Any other element without a shadcn equivalent needs a comment with a reason directly above it:
 *   `<!-- native-ui-ok: needs a native color picker -->`.
 *
 * Out of scope: the shadcn components themselves, test stubs, and `packages/svelte`, a library
 * that renders plain HTML on purpose.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { parse } from "svelte/compiler";

const ALLOW_MARKER = "native-ui-ok:";
/** Applications built with shadcn-svelte. */
const ROOTS = ["packages/ui/src"];
const IGNORED_DIRECTORIES = new Set(["node_modules", ".svelte-kit", "build", "dist", "test-stubs"]);
const SHADCN_DIRECTORY = join("components", "ui");

const TABLE = "Table";
const REPLACEMENTS: Record<string, string> = {
  input: "Input, Checkbox, RadioGroup or Switch",
  textarea: "Textarea",
  select: "Select",
  label: "Label (or Form.Field)",
  button: "Button",
  dialog: "Dialog or Sheet",
  table: TABLE,
  thead: TABLE,
  tbody: TABLE,
  tfoot: TABLE,
  tr: TABLE,
  th: TABLE,
  td: TABLE,
  progress: "Progress",
  hr: "Separator",
  details: "Collapsible or Accordion",
};

type AstNode = {
  type?: string;
  name?: string;
  data?: string;
  start?: number;
  [key: string]: unknown;
};

export interface NativeUiProblem {
  file: string;
  line: number;
  element: string;
  hint: string;
}

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null;
}

/** `something.as("hidden", ...)`, as produced by SvelteKit's form field helpers. */
function isFieldAsHidden(expression: unknown): boolean {
  if (!isNode(expression) || expression.type !== "CallExpression") return false;
  const { callee, arguments: args } = expression;
  if (!isNode(callee) || callee.type !== "MemberExpression" || !isNode(callee.property))
    return false;
  const first = Array.isArray(args) ? args[0] : undefined;
  return callee.property.name === "as" && isNode(first) && first.value === "hidden";
}

function isHiddenInput(node: AstNode): boolean {
  if (node.name !== "input" || !Array.isArray(node.attributes)) return false;
  return node.attributes.some((attribute: unknown) => {
    if (!isNode(attribute)) return false;
    if (attribute.type === "Attribute" && attribute.name === "type") {
      const value = attribute.value;
      return (
        Array.isArray(value) && value.length === 1 && isNode(value[0]) && value[0].data === "hidden"
      );
    }
    return attribute.type === "SpreadAttribute" && isFieldAsHidden(attribute.expression);
  });
}

/** Is the closest preceding non-whitespace sibling an allow comment with a reason? */
function isAllowed(siblings: readonly unknown[], index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const previous = siblings[i];
    if (!isNode(previous)) return false;
    if (previous.type === "Text" && (previous.data ?? "").trim() === "") continue;
    if (previous.type !== "Comment") return false;
    const comment = (previous.data ?? "").trim();
    return comment.startsWith(ALLOW_MARKER) && comment.slice(ALLOW_MARKER.length).trim() !== "";
  }
  return false;
}

function collect(value: unknown, siblings: readonly unknown[], index: number, found: AstNode[]) {
  if (Array.isArray(value)) {
    for (const [i, child] of value.entries()) collect(child, value, i, found);
    return;
  }
  if (!isNode(value)) return;
  if (value.type === "RegularElement" && value.name && value.name in REPLACEMENTS) {
    if (!isHiddenInput(value) && !isAllowed(siblings, index)) found.push(value);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "metadata") continue;
    collect(child, [], 0, found);
  }
}

/** Finds native elements in the template of one Svelte file. */
export function checkNativeUiElements(source: string, file = "fixture.svelte"): NativeUiProblem[] {
  const ast = parse(source, { modern: true, filename: file });
  const found: AstNode[] = [];
  collect(ast.fragment, [], 0, found);
  return found.map((node) => ({
    file,
    line: source.slice(0, node.start ?? 0).split("\n").length,
    element: node.name ?? "",
    hint: REPLACEMENTS[node.name ?? ""] ?? "",
  }));
}

async function svelteFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || path.endsWith(sep + SHADCN_DIRECTORY)) continue;
      files.push(...(await svelteFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".svelte")) {
      files.push(path);
    }
  }
  return files;
}

export async function checkRepository(root = resolve(".")): Promise<NativeUiProblem[]> {
  const problems: NativeUiProblem[] = [];
  for (const dir of ROOTS) {
    for (const file of await svelteFiles(join(root, dir))) {
      const source = await readFile(file, "utf8");
      problems.push(...checkNativeUiElements(source, relative(root, file).split(sep).join("/")));
    }
  }
  return problems;
}

if (import.meta.main) {
  const problems = await checkRepository();
  for (const problem of problems) {
    console.error(
      `${problem.file}:${problem.line}: <${problem.element}> -> use the shadcn ${problem.hint}`,
    );
  }
  if (problems.length > 0) {
    console.error(
      `\nNative elements with a shadcn component. Use the component, or add ` +
        `\`<!-- ${ALLOW_MARKER} reason -->\` above the element if there is no equivalent.`,
    );
    process.exit(1);
  }
  console.log("Native UI elements comply with the project policy.");
}
