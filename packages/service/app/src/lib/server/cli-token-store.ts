const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface Entry {
  apiKey: string;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function storeCliToken(code: string, apiKey: string): void {
  store.set(code, { apiKey, expiresAt: Date.now() + TTL_MS });
}

export function consumeCliToken(code: string): string | null {
  const entry = store.get(code);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(code);
    return null;
  }
  store.delete(code);
  return entry.apiKey;
}
