import { describe, expect, it } from "bun:test";
import {
  asColor,
  colorFromHex,
  colorFromRgba,
  colorToCss,
  colorToHex,
  colorToRgba,
  isColor,
} from "./colors";

describe("Color", () => {
  it("stores colors as unsigned 0xRRGGBBAA values", () => {
    const color = colorFromRgba(0x12, 0x34, 0x56, 0x78);

    expect(Number(color)).toBe(0x12345678);
    expect(isColor(color)).toBe(true);
    expect(colorToRgba(color)).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 0x78 });
  });

  it("parses and renders hex colors", () => {
    expect(Number(colorFromHex("#369"))).toBe(0x336699ff);
    expect(Number(colorFromHex("#369c"))).toBe(0x336699cc);
    expect(Number(colorFromHex("#33669980"))).toBe(0x33669980);
    expect(Number(colorFromHex("#336699", 0x40))).toBe(0x33669940);
    expect(colorToHex(0x33669980)).toBe("#33669980");
    expect(colorToHex(0x33669980, false)).toBe("#336699");
    expect(colorToCss(0x33669980)).toBe("#33669980");
  });

  it("rejects invalid values", () => {
    expect(() => asColor(-1)).toThrow(RangeError);
    expect(() => asColor(0x100000000)).toThrow(RangeError);
    expect(() => colorFromHex("not-a-color")).toThrow(TypeError);
    expect(() => colorFromRgba(256, 0, 0)).toThrow(RangeError);
  });
});
