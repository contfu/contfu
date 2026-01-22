/**
 * Creates compress/expand functions for combining two integers into one.
 * The combined integer can represent values up to 52 bits (JavaScript safe integer limit).
 */
export function combine2ints(size1: number, size2: number) {
  if (size1 + size2 > 52) {
    throw new Error(`Combined size ${size1 + size2} exceeds 52-bit limit`);
  }
  const shift = 2 ** size2;
  const mask = shift - 1;
  return [
    (a: number, b: number) => a * shift + (b & mask),
    (combined: number) => [Math.floor(combined / shift), combined & mask] as [number, number],
  ] as const;
}

/**
 * Creates compress/expand functions for combining three integers into one.
 * The combined integer can represent values up to 52 bits (JavaScript safe integer limit).
 */
export function combine3ints(size1: number, size2: number, size3: number) {
  if (size1 + size2 + size3 > 52) {
    throw new Error(`Combined size ${size1 + size2 + size3} exceeds 52-bit limit`);
  }
  const shift1 = 2 ** size2;
  const shift2 = 2 ** size3;
  const shift12 = shift1 * shift2;
  const mask1 = shift1 - 1;
  const mask2 = shift2 - 1;
  return [
    (a: number, b: number, c: number) => a * shift12 + b * shift2 + c * mask2,
    (combined: number) =>
      [Math.floor(combined / shift12), Math.floor(combined / shift1) & mask1, combined & mask2] as [
        number,
        number,
        number,
      ],
  ] as const;
}
