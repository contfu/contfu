/** Queue class to handle the communication between producer and consumer */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: IteratorResult<T>) => void)[] = [];
  private isDone = false;

  /** Add a new value to the queue */
  push(value: T) {
    if (this.isDone) {
      throw new Error("Queue is closed");
    }

    if (this.resolvers.length > 0) {
      // If there are waiting resolvers, resolve the first one
      const resolver = this.resolvers.shift()!;
      resolver({ value, done: false });
    } else {
      // Otherwise, add to the queue
      this.queue.push(value);
    }
  }

  /** Mark the queue as complete */
  complete() {
    this.isDone = true;
    // Resolve all waiting resolvers with done: true
    while (this.resolvers.length > 0) {
      const resolver = this.resolvers.shift()!;
      resolver({ value: undefined, done: true });
    }
  }

  /** Get the next value from the queue */
  async next(): Promise<IteratorResult<T>> {
    if (this.queue.length > 0) {
      // If there are queued values, return the first one
      const value = this.queue.shift()!;
      return { value, done: false };
    }

    if (this.isDone) {
      return { value: undefined, done: true };
    }

    // If no values are available, return a promise that will resolve
    // when a value becomes available
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  createGenerator(): AsyncGenerator<T> {
    const self = this;
    return (async function* () {
      while (true) {
        const result = await self.next();
        if (result.done) return;
        yield result.value;
      }
    })();
  }
}
