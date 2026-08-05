import { encode } from "@toon-format/toon";

export type StructuredOutputFormat = "json" | "agent";
export type OutputFormat = "default" | StructuredOutputFormat;

export interface StructuredOutputOptions {
  full?: boolean;
  compact?: unknown;
}

export function printStructured(
  data: unknown,
  format: StructuredOutputFormat,
  options: StructuredOutputOptions = {},
): void {
  const output = format === "agent" && !options.full ? (options.compact ?? data) : data;
  console.log(format === "agent" ? encode(output) : JSON.stringify(output, null, 2));
}

export function isStructuredOutputFormat(format: string): format is StructuredOutputFormat {
  return format === "json" || format === "agent";
}

export function isOutputFormat(format: string): format is OutputFormat {
  return format === "default" || isStructuredOutputFormat(format);
}
