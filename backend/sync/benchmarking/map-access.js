import { heapStats } from "bun:jsc";

function populateMap(map, size) {
  for (let i = 0; i < size; i++) {
    map.set(i, i);
  }
}

function accessMap(map, keys) {
  for (let i = 0; i < keys.length; i++) {
    map.get(keys[i]);
  }
}

function populateObject(obj, size) {
  for (let i = 0; i < size; i++) {
    obj[i] = i;
  }
}

function accessObject(obj, keys) {
  for (let i = 0; i < keys.length; i++) {
    void obj[keys[i]];
  }
}

// Benchmark both approaches
function benchmark(iterations, mapSize) {
  const map = new Map();
  const keys = randomKeys(mapSize, iterations);
  let initialHeapSize = heapStats().heapSize;

  console.time("populate map");
  populateMap(map, mapSize);
  console.timeEnd("populate map");
  console.log("Heap size", heapStats().heapSize - initialHeapSize);

  console.time("access map");
  accessMap(map, keys);
  console.timeEnd("access map");

  const obj = {};
  console.time("populate object");
  populateObject(obj, mapSize);
  console.timeEnd("populate object");
  console.log("Heap size", heapStats().heapSize - initialHeapSize);

  console.time("access object");
  accessObject(obj, keys);
  console.timeEnd("access object");
}

function randomKeys(range, count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * range));
}

benchmark(10_000_000, 10_000_000);
