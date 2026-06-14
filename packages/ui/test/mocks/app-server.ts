export function query<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
