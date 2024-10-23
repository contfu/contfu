import assert from "node:assert";

export function combine2int32(size1: number, size2: number) {
  assert(size1 + size2 <= 32);
  const mask1 = 2 ** size2 - 1;
  return [
    (a: number, b: number) => (a << size2) | b,
    (combined: number) => {
      const b = combined & mask1;
      const a = combined >> size2;
      return [a, b];
    },
  ];
}

export function combine2ints(size1: number, size2: number) {
  assert(size1 + size2 <= 52);
  const shift = 2 ** size2;
  const mask = shift - 1;
  return [
    (a: number, b: number) => a * shift + b * mask,
    (combined: number) =>
      [Math.floor(combined / shift), combined & mask] as const,
  ] as const;
}
export function combine3ints(size1: number, size2: number, size3: number) {
  assert(size1 + size2 + size3 <= 52);
  const shift1 = 2 ** size2;
  const shift2 = 2 ** size3;
  const shift12 = shift1 * shift2;
  const mask1 = shift1 - 1;
  const mask2 = shift2 - 1;
  return [
    (a: number, b: number, c: number) => a * shift12 + b * shift2 + c * mask2,
    (combined: number) =>
      [
        Math.floor(combined / shift12),
        Math.floor(combined / shift1) & mask1,
        combined & mask2,
      ] as const,
  ] as const;
}
