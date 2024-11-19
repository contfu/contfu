export class SortedSet<T> extends Array<T> {
  readonly #compare: (a: T, b: T) => number;

  constructor({
    seed = [] as T[],
    isSorted = false,
    compare = (a: T, b: T) => (a as number) - (b as number),
  } = {}) {
    super(...seed);
    if (!isSorted) this.sort(compare);
    this.#compare = compare;
  }

  search(el: T): [boolean, number] {
    let left = 0;
    let right = this.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const comp = this.#compare(el, this[mid]);
      if (comp === 0) return [true, mid];
      if (comp > 0) left = mid + 1;
      else right = mid - 1;
    }
    return [false, left];
  }

  add(el: T) {
    const [found, index] = this.search(el);
    if (!found) this.splice(index, 0, el);
  }

  has(el: T) {
    return this.search(el)[0];
  }

  delete(el: T) {
    const [found, index] = this.search(el);
    if (found) this.splice(index, 1);
    return found;
  }

  override push(...items: T[]): number {
    for (const item of items) this.add(item);
    return this.length;
  }

  concat(items: T[]) {
    const newSet = new SortedSet<T>({
      compare: this.#compare,
      seed: this,
      isSorted: true,
    });

    for (const item of items) newSet.add(item);
    return newSet;
  }
}
