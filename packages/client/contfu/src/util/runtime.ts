import * as Bun from "bun";

export function detectRuntime(): "bun" | "node" | "deno" {
  if (typeof Bun !== "undefined") {
    return "bun";
  }
  // @ts-ignore - Deno global may not be defined in all environments
  if (typeof Deno !== "undefined") {
    return "deno";
  }
  return "node";
}
