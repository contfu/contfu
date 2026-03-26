import { AsyncLocalStorage } from "node:async_hooks";

const logContext = new AsyncLocalStorage<Record<string, string>>();

/**
 * Runs `fn` inside a logging context. The given fields are merged onto any
 * parent context so nested calls accumulate rather than replace.
 */
export function withLogContext<T>(ctx: Record<string, string>, fn: () => T): T {
  const parent = logContext.getStore();
  return logContext.run({ ...parent, ...ctx }, fn);
}

/**
 * Returns the current logging context, or an empty object if none is active.
 */
export function getLogContext(): Record<string, string> {
  return logContext.getStore() ?? {};
}
