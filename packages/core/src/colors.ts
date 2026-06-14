declare const ColorBrand: unique symbol;

/**
 * Canonical Contfu color value stored as an unsigned 32-bit 0xRRGGBBAA number.
 */
export type Color = number & { readonly [ColorBrand]: "Color" };

export type ColorRgba = {
  /** Red channel, 0-255. */
  r: number;
  /** Green channel, 0-255. */
  g: number;
  /** Blue channel, 0-255. */
  b: number;
  /** Alpha channel, 0-255. */
  a: number;
};

const MAX_COLOR = 0xffffffff;

function assertByte(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`${name} must be an integer from 0 to 255`);
  }
  return value;
}

function hexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function parseHexByte(value: string): number {
  return Number.parseInt(value, 16);
}

/** Returns true when a value is a valid canonical 0xRRGGBBAA color number. */
export function isColor(value: unknown): value is Color {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_COLOR;
}

/** Validate and brand an existing unsigned 32-bit 0xRRGGBBAA value as a Color. */
export function asColor(value: number): Color {
  if (!isColor(value)) throw new RangeError("Color must be an unsigned 32-bit 0xRRGGBBAA number");
  return value;
}

/** Create a Color from byte RGBA channels. */
export function colorFromRgba(r: number, g: number, b: number, a = 255): Color {
  return (((assertByte(r, "r") << 24) |
    (assertByte(g, "g") << 16) |
    (assertByte(b, "b") << 8) |
    assertByte(a, "a")) >>>
    0) as Color;
}

/** Split a Color into byte RGBA channels. */
export function colorToRgba(color: Color | number): ColorRgba {
  const value = asColor(color);
  return {
    r: (value >>> 24) & 0xff,
    g: (value >>> 16) & 0xff,
    b: (value >>> 8) & 0xff,
    a: value & 0xff,
  };
}

/**
 * Parse CSS-style hex colors (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) into a Color.
 * Six-digit hex values default to fully opaque unless an alpha byte override is supplied.
 */
export function colorFromHex(hex: string, alpha?: number): Color {
  const normalized = hex.trim().replace(/^#/, "");
  if (![3, 4, 6, 8].includes(normalized.length) || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new TypeError("Color hex must be #RGB, #RGBA, #RRGGBB, or #RRGGBBAA");
  }

  const expanded =
    normalized.length <= 4
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const r = parseHexByte(expanded.slice(0, 2));
  const g = parseHexByte(expanded.slice(2, 4));
  const b = parseHexByte(expanded.slice(4, 6));
  const a = alpha ?? (expanded.length === 8 ? parseHexByte(expanded.slice(6, 8)) : 255);
  return colorFromRgba(r, g, b, a);
}

/** Render a Color as #RRGGBBAA (or #RRGGBB when includeAlpha is false). */
export function colorToHex(color: Color | number, includeAlpha = true): string {
  const { r, g, b, a } = colorToRgba(color);
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${includeAlpha ? hexByte(a) : ""}`;
}

/** Render a Color as a CSS-compatible #RRGGBBAA value. */
export function colorToCss(color: Color | number): string {
  return colorToHex(color);
}
