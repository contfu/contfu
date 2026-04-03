import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

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

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function hasPackageJson(): boolean {
  return existsSync(join(process.cwd(), "package.json"));
}

function readDependencies(): Record<string, string> {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

export async function setup(): Promise<void> {
  // 1. Check for package.json
  if (!hasPackageJson()) {
    console.error(
      "No package.json found in the current directory. Run this from a Node.js project.",
    );
    process.exit(1);
  }

  // 2. Check if already set up
  const deps = readDependencies();
  if (deps["@contfu/contfu"]) {
    console.log("This project already has @contfu/contfu installed (local sync mode).");
    console.log("Run `contfu status` to see your current setup.");
    return;
  }
  if (deps["@contfu/client"]) {
    console.log("This project already has @contfu/client installed (remote client mode).");
    console.log("Run `contfu status` to see your current setup.");
    return;
  }

  // 3. Check authentication
  if (!getApiKey()) {
    console.log("You need to log in first.\n");
    const { login } = await import("./login");
    await login();
    console.log();
  }

  // 4. Ask for mode
  console.log("How do you want to use Contfu in this project?\n");
  console.log("  1. Local sync — sync content to a local database (@contfu/contfu)");
  console.log("     Best for: server-side apps, static site generators, offline-capable apps\n");
  console.log("  2. Remote client — query content from a Contfu server (@contfu/client)");
  console.log("     Best for: browser apps, edge functions, multi-client setups\n");

  const choice = await prompt("Choose (1 or 2): ");

  if (choice === "1") {
    console.log("\nInstall @contfu/contfu to get started:\n");
    console.log("  npm install @contfu/contfu");
    console.log("  # or: bun add @contfu/contfu\n");
    console.log("Then run `contfu setup` again to continue configuration.");
  } else if (choice === "2") {
    console.log("\nInstall @contfu/client to get started:\n");
    console.log("  npm install @contfu/client");
    console.log("  # or: bun add @contfu/client\n");
    console.log("Then run `contfu setup` again to continue configuration.");
  } else {
    console.error("Invalid choice. Please enter 1 or 2.");
    process.exit(1);
  }
}
