export class SortedSet<T> extends Array<T> {
  private readonly key: (x: T) => number;

  constructor({
    key = ((x) => x as unknown as number) as (x: T) => number,
    seed = [] as T[],
  } = {}) {
    super(...(seed ?? []));
    this.sort((a, b) => key(a) - key(b));
    this.key = key;
  }

  search(el: T): [boolean, number] {
    let left = 0;
    let right = this.length - 1;
    const k1 = this.key(el);

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const k2 = this.key(this[mid]);
      if (k2 === k1) return [true, mid];
      if (k2 < k1) left = mid + 1;
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

  /**
   * Appends items to the end of the set. Make sure the items are sorted.
   */
  unsafeAppend(items: T[]) {
    super.push(...items);
  }

  concat(items: T[]) {
    const newSet = new SortedSet<T>({ key: this.key, seed: this });

    for (const item of items) newSet.add(item);
    console.log(newSet);
    return newSet;
  }
}
