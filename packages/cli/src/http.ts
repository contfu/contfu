import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function getApiKey(): string | undefined {
  if (process.env.CONTFU_API_KEY) return process.env.CONTFU_API_KEY;

  try {
    const configPath = join(homedir(), ".config", "contfu", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config.apiKey;
  } catch {
    return undefined;
  }
}

function getBaseUrl(): string {
  return process.env.CONTFU_URL ?? "https://contfu.com";
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error(
      "No API key configured. Set CONTFU_API_KEY or create ~/.config/contfu/config.json",
    );
    process.exit(1);
  }

  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 403) {
      console.error(
        "Insufficient permissions. Your API key does not have the required scope for this action.",
      );
      process.exit(1);
    }
    if (res.status === 429) {
      console.error("Rate limit exceeded. Please slow down and try again.");
      process.exit(1);
    }
    const text = await res.text();
    console.error(`Error ${res.status}: ${text}`);
    process.exit(1);
  }

  return res;
}
