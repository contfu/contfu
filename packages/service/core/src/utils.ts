export function toCamelCase(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/ (.)/g, (_, char) => char.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}
