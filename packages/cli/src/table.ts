export type TableColumn<T> = {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

function terminalLinksEnabled(): boolean {
  return process.env.CONTFU_CLI_LINKS !== "0" && process.env.NO_COLOR === undefined;
}

function sanitizeLinkTarget(value: string): string {
  return value.replaceAll("\u001b", "").replaceAll("\u0007", "");
}

export function terminalLink(label: string, url: string): string {
  if (!terminalLinksEnabled()) return label;
  const target = sanitizeLinkTarget(url);
  return `\u001b]8;;${target}\u0007${label}\u001b]8;;\u0007`;
}

function graphemes(value: string): string[] {
  const segmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new (
          Intl as unknown as {
            Segmenter: new (...args: unknown[]) => {
              segment: (input: string) => Iterable<{ segment: string }>;
            };
          }
        ).Segmenter(undefined, { granularity: "grapheme" })
      : null;
  return segmenter ? [...segmenter.segment(value)].map((part) => part.segment) : Array.from(value);
}

/** Inclusive `[start, end]` code point ranges, sorted and non-overlapping. */
type CodePointRange = readonly [number, number];

/** Binary search over sorted ranges, so widening a table costs no complexity. */
function inRanges(ranges: readonly CodePointRange[], codePoint: number): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const [start, end] = ranges[mid];
    if (codePoint < start) high = mid - 1;
    else if (codePoint > end) low = mid + 1;
    else return true;
  }
  return false;
}

/** East Asian Wide and Fullwidth code points, which occupy two terminal cells. */
const FULL_WIDTH_RANGES: readonly CodePointRange[] = [
  [0x1100, 0x115f],
  [0x2329, 0x232a],
  [0x2e80, 0x303e],
  [0x3040, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
];

function isFullWidthCodePoint(codePoint: number): boolean {
  return inRanges(FULL_WIDTH_RANGES, codePoint);
}

/**
 * Combining marks, variation selectors, and the zero-width joiner: code points
 * that render on top of a neighbour rather than in a cell of their own.
 */
const ZERO_WIDTH_RANGES: readonly CodePointRange[] = [
  [0x0300, 0x036f],
  [0x0483, 0x0489],
  [0x0591, 0x05bd],
  [0x05bf, 0x05bf],
  [0x05c1, 0x05c2],
  [0x05c4, 0x05c5],
  [0x05c7, 0x05c7],
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
  [0x0711, 0x0711],
  [0x0730, 0x074a],
  [0x07a6, 0x07b0],
  [0x07eb, 0x07f3],
  [0x0816, 0x0819],
  [0x081b, 0x0823],
  [0x0825, 0x0827],
  [0x0829, 0x082d],
  [0x0859, 0x085b],
  [0x08d3, 0x08e1],
  [0x08e3, 0x0903],
  [0x093a, 0x093a],
  [0x093c, 0x093c],
  [0x0941, 0x0948],
  [0x094d, 0x094d],
  [0x0951, 0x0957],
  [0x0962, 0x0963],
  [0x200d, 0x200d],
  [0xfe00, 0xfe0f],
];

function isZeroWidthCodePoint(codePoint: number): boolean {
  return inRanges(ZERO_WIDTH_RANGES, codePoint);
}

function stripZeroWidth(value: string): string {
  return Array.from(value)
    .filter((char) => !isZeroWidthCodePoint(char.codePointAt(0) ?? 0))
    .join("");
}

function stripAnsi(value: string): string {
  let result = "";
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) === 0x1b && value[i + 1] === "]") {
      i += 2;
      while (i < value.length) {
        if (value.charCodeAt(i) === 0x07) break;
        if (value.charCodeAt(i) === 0x1b && value[i + 1] === "\\") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (value.charCodeAt(i) === 0x1b && value[i + 1] === "[") {
      i += 2;
      while (i < value.length) {
        const code = value.charCodeAt(i);
        if (code >= 0x40 && code <= 0x7e) break;
        i += 1;
      }
      continue;
    }
    result += value[i];
  }
  return result;
}

function isEmojiCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1f000 && codePoint <= 0x1faff) || (codePoint >= 0x2600 && codePoint <= 0x27bf)
  );
}

function emojiWidth(): number {
  return process.env.CONTFU_CLI_EMOJI_WIDTH === "2" ? 2 : 1;
}

function graphemeWidth(value: string): number {
  const stripped = stripZeroWidth(value);
  if (stripped.length === 0) return 0;
  const codePoints = Array.from(stripped, (char) => char.codePointAt(0) ?? 0);
  if (codePoints.some(isEmojiCodePoint)) return emojiWidth();
  return codePoints.reduce(
    (width, codePoint) => width + (isFullWidthCodePoint(codePoint) ? 2 : 1),
    0,
  );
}

export function visibleWidth(value: string): number {
  return graphemes(stripAnsi(value)).reduce(
    (width, grapheme) => width + graphemeWidth(grapheme),
    0,
  );
}

function padEndVisible(value: string, width: number): string {
  const padding = width - visibleWidth(value);
  return padding > 0 ? `${value}${" ".repeat(padding)}` : value;
}

export function printTable<T>(rows: T[], columns: TableColumn<T>[]) {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }

  const cell = (column: TableColumn<T>, row: T) => String(column.value(row) ?? "");
  const widths = columns.map((column) =>
    Math.max(column.header.length, ...rows.map((row) => visibleWidth(cell(column, row)))),
  );

  console.log(
    columns.map((column, index) => padEndVisible(column.header, widths[index])).join("  "),
  );
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(
      columns.map((column, index) => padEndVisible(cell(column, row), widths[index])).join("  "),
    );
  }
}
