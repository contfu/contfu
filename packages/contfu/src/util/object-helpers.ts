export function deleteNulls<T>(obj: T): {
  [K in keyof T]: Exclude<T[K], null>;
} {
  for (const key in obj) {
    if (obj[key] === null) {
      delete obj[key];
    }
  }
  return obj as any;
}
