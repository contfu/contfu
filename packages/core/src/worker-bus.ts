// Maximum safe integer for request IDs (use 2^31-1 to avoid issues)
const MAX_REQUEST_ID = 2147483647;

/**
 * Message bus for request/response correlation between app and worker.
 * Handles async request/response patterns with timeout support.
 */
export class MessageBus<TResponse> {
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: TResponse) => void;
      reject: (error: Error) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(private readonly timeout: number = 30_000) {}

  /**
   * Creates a request with a unique ID and returns a promise that resolves
   * when the response is received.
   */
  request<T extends TResponse>(requestId: number): Promise<T> {
    // Check for ID collision
    if (this.pending.has(requestId)) {
      return Promise.reject(new Error(`Request ID ${requestId} already in use`));
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${this.timeout}ms`));
      }, this.timeout);

      this.pending.set(requestId, {
        resolve: resolve as (value: TResponse) => void,
        reject,
        timeoutId,
      });
    });
  }

  /**
   * Generates a unique request ID. Wraps around at MAX_REQUEST_ID.
   */
  generateId(): number {
    const id = this.nextId;
    this.nextId = this.nextId >= MAX_REQUEST_ID ? 1 : this.nextId + 1;
    return id;
  }

  /**
   * Resolves a pending request with the given response.
   * Returns true if the request was found and resolved, false otherwise.
   */
  respond(requestId: number, response: TResponse): boolean {
    const pending = this.pending.get(requestId);
    if (!pending) return false;

    clearTimeout(pending.timeoutId);
    this.pending.delete(requestId);
    pending.resolve(response);
    return true;
  }

  /**
   * Rejects a pending request with the given error.
   * Returns true if the request was found and rejected, false otherwise.
   */
  reject(requestId: number, error: Error): boolean {
    const pending = this.pending.get(requestId);
    if (!pending) return false;

    clearTimeout(pending.timeoutId);
    this.pending.delete(requestId);
    pending.reject(error);
    return true;
  }

  /**
   * Clears all pending requests, rejecting them with the given error.
   */
  clear(error: Error = new Error("Message bus cleared")): void {
    for (const [_id, pending] of this.pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pending.clear();
  }

  /**
   * Returns the number of pending requests.
   */
  get pendingCount(): number {
    return this.pending.size;
  }
}
