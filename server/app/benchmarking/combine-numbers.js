import assert from "node:assert";

function combineNumbers(x, y) {
  return Number((BigInt(y) << 32n) | BigInt(x));
}

// To extract numbers back
function extractNumbers(combined) {
  const combinedBigInt = BigInt(combined);
  const x = Number(combinedBigInt & 0xffffffffn); // Get lower 32 bits
  const y = Number((combinedBigInt >> 32n) & 0xffffn); // Get upper 16 bits
  return [x, y];
}

function combineNumbers32(x, y) {
  return (y << 22) | x;
}

// To extract numbers back
function extractNumbers32(combined) {
  const x = combined & 0x3fffff; // Get lower 22 bits
  const y = (combined >> 22) & 0x3ff; // Get upper 10 bits
  return [x, y];
}

const yFactor = 0x4000000;
const xMask = 0x3ffffff;
function combineNumbers52(x, y) {
  return y * yFactor + (x & xMask);
}

// To extract numbers back
function extractNumbers52(combined) {
  const x = combined & xMask; // Get lower 26 bits
  const y = Math.floor(combined / yFactor); // Get upper 26 bits
  return [x, y];
}

function combineNumbersBuffer(x, y) {
  const buffer = new ArrayBuffer(6);
  const view = new DataView(buffer);
  view.setUint32(0, x, true); // true for little-endian
  view.setUint16(4, y, true);
  return buffer;
}

function extractNumbersBuffer(buffer) {
  const view = new DataView(buffer);
  const x = view.getUint32(0, true);
  const y = view.getUint16(4, true);
  return [x, y];
}

// Benchmark both approaches
function benchmark(iterations) {
  const x = 4_000_000;
  const y = 1_000;
  const [ex1, ey1] = extractNumbers32(combineNumbers32(x, y));
  assert(ex1 === x && ey1 === y);
  const [ex2, ey2] = extractNumbers52(combineNumbers52(x, y));
  console.log(ex2, ey2);

  assert(ex2 === x && ey2 === y);
  const [ex3, ey3] = extractNumbers(combineNumbers(x, y));
  assert(ex3 === x && ey3 === y);
  const [ex4, ey4] = extractNumbersBuffer(combineNumbersBuffer(x, y));
  assert(ex4 === x && ey4 === y);

  console.time("32 bit approach");
  for (let i = 0; i < iterations; i++) {
    const combined = combineNumbers32(x, y);
    extractNumbers32(combined);
  }
  console.timeEnd("32 bit approach");

  console.time("52 bit approach");
  for (let i = 0; i < iterations; i++) {
    const combined = combineNumbers52(x, y);
    extractNumbers52(combined);
  }
  console.timeEnd("52 bit approach");

  console.time("BigInt approach");
  for (let i = 0; i < iterations; i++) {
    const combined = combineNumbers(x, y);
    extractNumbers(combined);
  }
  console.timeEnd("BigInt approach");

  console.time("Buffer approach");
  for (let i = 0; i < iterations; i++) {
    const buffer = combineNumbersBuffer(x, y);
    extractNumbersBuffer(buffer);
  }
  console.timeEnd("Buffer approach");
}

// Run benchmark with 1 million iterations
benchmark(10000000);
