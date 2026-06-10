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

function isFullWidthCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6))
  );
}

function isZeroWidthCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x0483 && codePoint <= 0x0489) ||
    (codePoint >= 0x0591 && codePoint <= 0x05bd) ||
    codePoint === 0x05bf ||
    (codePoint >= 0x05c1 && codePoint <= 0x05c2) ||
    (codePoint >= 0x05c4 && codePoint <= 0x05c5) ||
    codePoint === 0x05c7 ||
    (codePoint >= 0x0610 && codePoint <= 0x061a) ||
    (codePoint >= 0x064b && codePoint <= 0x065f) ||
    codePoint === 0x0670 ||
    (codePoint >= 0x06d6 && codePoint <= 0x06dc) ||
    (codePoint >= 0x06df && codePoint <= 0x06e4) ||
    (codePoint >= 0x06e7 && codePoint <= 0x06e8) ||
    (codePoint >= 0x06ea && codePoint <= 0x06ed) ||
    codePoint === 0x0711 ||
    (codePoint >= 0x0730 && codePoint <= 0x074a) ||
    (codePoint >= 0x07a6 && codePoint <= 0x07b0) ||
    (codePoint >= 0x07eb && codePoint <= 0x07f3) ||
    (codePoint >= 0x0816 && codePoint <= 0x0819) ||
    (codePoint >= 0x081b && codePoint <= 0x0823) ||
    (codePoint >= 0x0825 && codePoint <= 0x0827) ||
    (codePoint >= 0x0829 && codePoint <= 0x082d) ||
    (codePoint >= 0x0859 && codePoint <= 0x085b) ||
    (codePoint >= 0x08d3 && codePoint <= 0x08e1) ||
    (codePoint >= 0x08e3 && codePoint <= 0x0903) ||
    codePoint === 0x093a ||
    codePoint === 0x093c ||
    (codePoint >= 0x0941 && codePoint <= 0x0948) ||
    codePoint === 0x094d ||
    (codePoint >= 0x0951 && codePoint <= 0x0957) ||
    (codePoint >= 0x0962 && codePoint <= 0x0963) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    codePoint === 0x200d
  );
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
