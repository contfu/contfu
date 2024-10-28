// Approach 1: Map-based consumer selection
type Consumer = {
  id: string;
  handle: (message: any) => void;
};

class MapBasedDistributor {
  private consumers = new Set<number>();

  addConsumer(id: number) {
    this.consumers.add(id);
  }

  // O(n) where n is the number of matching consumers
  distribute(message: { recipients: number[]; content: any }) {
    message.recipients.forEach((recipientId) => {
      if (this.consumers.has(recipientId)) {
        console.log(message);
      }
    });
  }
}

// Approach 2: Callback-based filtering
type MessageFilter = (message: any) => boolean;

class CallbackBasedDistributor {
  private consumers: {
    filter: MessageFilter;
    handle: (message: any) => void;
  }[] = [];

  addConsumer(filter: MessageFilter, handler: (message: any) => void) {
    this.consumers.push({ filter, handle: handler });
  }

  // O(n) where n is total number of consumers
  distribute(message: any) {
    this.consumers.forEach((consumer) => {
      if (consumer.filter(message)) {
        consumer.handle(message);
      }
    });
  }
}

// Memory usage comparison
const mapBased = new MapBasedDistributor();
const callbackBased = new CallbackBasedDistributor();

let rss = process.memoryUsage().rss;
// Adding 1000 consumers
console.time(`mapBased`);
for (let i = 0; i < 10000; i++) {
  // Map-based: Stores consumer ID + handler
  mapBased.addConsumer(i);
}
console.timeEnd(`mapBased`);
console.log(`mapBased rss: ${process.memoryUsage().rss - rss}`);

rss = process.memoryUsage().rss;
console.time(`callbackBased`);
for (let i = 0; i < 10000; i++) {
  // Callback-based: Stores filter function + handler
  callbackBased.addConsumer(
    (msg) => msg.type === `type-${i % 10}`,
    (msg) => console.log(msg)
  );
}
console.timeEnd(`callbackBased`);
console.log(`callbackBased rss: ${process.memoryUsage().rss - rss}`);
