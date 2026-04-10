import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { getApiKey } from "../http";
import { getAppKey, writeEnvKey, ensureGitignore } from "../env";
import { prompt, select, type SelectOption } from "./select";

export interface SetupOptions {
  package?: string;
  appName?: string;
  envFile?: string;
  nonInteractive?: boolean;
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

function detectPackageManager(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function installPackage(pkg: string): void {
  const pm = detectPackageManager();
  const cmd = pm === "npm" ? `npm install ${pkg}` : `${pm} add ${pkg}`;
  console.log(`\nInstalling ${pkg} with ${pm}...\n`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

export async function setup(opts: SetupOptions = {}): Promise<void> {
  const nonInteractive = opts.nonInteractive ?? false;

  // 1. Check for package.json
  if (!hasPackageJson()) {
    console.error(
      "No package.json found in the current directory. Run this from a Node.js project.",
    );
    process.exit(1);
  }

  // 2. Check if package already installed — skip if so
  const deps = readDependencies();
  let pkgToInstall: string | undefined;

  if (deps["@contfu/contfu"]) {
    console.log("✓ @contfu/contfu already installed.");
  } else if (deps["@contfu/client"]) {
    console.log("✓ @contfu/client already installed.");
  } else {
    // Need to install — determine which package
    if (opts.package) {
      pkgToInstall = opts.package;
    } else if (nonInteractive) {
      console.error("Missing required flag: --package (@contfu/contfu or @contfu/client)");
      process.exit(1);
    } else {
      console.log("How do you want to use Contfu in this project?\n");
      pkgToInstall = await select([
        {
          label: "Local sync (@contfu/contfu)",
          description: "Best for: server-side apps, static site generators, offline-capable apps",
          value: "@contfu/contfu",
        },
        {
          label: "Remote client (@contfu/client)",
          description: "Best for: browser apps, edge functions, multi-client setups",
          value: "@contfu/client",
        },
      ]);
    }

    installPackage(pkgToInstall);
    console.log(`\n✓ ${pkgToInstall} installed successfully.\n`);
  }

  // 3. Check authentication
  if (!getApiKey()) {
    if (nonInteractive) {
      console.error("Not authenticated. Set CONTFU_API_KEY or run `contfu login` first.");
      process.exit(1);
    }
    console.log("You need to log in first.\n");
    const { login } = await import("./login");
    await login();
    console.log();
  }

  // 4. Set up app connection
  await setupAppConnection(opts);
}

async function setupAppConnection(opts: SetupOptions): Promise<void> {
  // If CONTFU_KEY is already configured, skip app connection setup
  const existingKey = getAppKey();
  if (existingKey) {
    const source = process.env.CONTFU_KEY ? "CONTFU_KEY env var" : ".env file";
    console.log(`✓ CONTFU_KEY already set (${source}). Skipping app connection setup.`);
    console.log("\n✓ Setup complete. Run `contfu status` to verify your configuration.");
    return;
  }

  const { getApiClient, handleApiError } = await import("../http");
  const { ConnectionTypeMeta } = await import("@contfu/svc-api");
  const client = getApiClient();
  const nonInteractive = opts.nonInteractive ?? false;

  // Check for existing app connections
  let connections: Awaited<ReturnType<typeof client.listConnections>>;
  try {
    connections = await client.listConnections();
  } catch (err) {
    handleApiError(err);
  }

  const appTypeId = Object.entries(ConnectionTypeMeta).find(
    ([, meta]) => meta.label === "app",
  )?.[0];
  const existingApps = connections.filter((c) => String(c.type) === appTypeId);

  let contfuKey: string;

  if (existingApps.length > 0 && nonInteractive) {
    // Non-interactive with no key: create new or fail
    if (!opts.appName) {
      console.error("Missing required flag: --app-name (no CONTFU_KEY found)");
      process.exit(1);
    }
    contfuKey = await createNewApp(client, opts);
  } else if (existingApps.length > 0) {
    // Interactive: offer create new, use existing, or skip
    console.log("How do you want to connect this app?\n");

    const options: SelectOption[] = [
      {
        label: "Create a new app",
        description: "Creates a new app connection and generates an API key",
        value: "new",
      },
      {
        label: "Use an existing app (generate new key)",
        description: "Pick from your existing apps and generate a fresh API key",
        value: "existing-regenerate",
      },
      {
        label: "Skip",
        description: "Set CONTFU_KEY yourself before starting the app",
        value: "skip",
      },
    ];

    const choice = await select(options);

    if (choice === "skip") {
      console.log("\nSkipped. Set CONTFU_KEY before starting your app.");
      console.log("\n✓ Setup complete. Run `contfu status` to verify your configuration.");
      return;
    } else if (choice === "new") {
      contfuKey = await createNewApp(client, opts);
    } else {
      console.log("\nYour app connections:\n");
      for (const [i, c] of existingApps.entries()) {
        console.log(`  ${i + 1}. ${c.name} (id: ${c.id})`);
      }
      console.log();

      const pick = await prompt(`Choose (1-${existingApps.length}): `);
      const idx = parseInt(pick, 10) - 1;
      if (idx < 0 || idx >= existingApps.length) {
        console.error("Invalid choice.");
        process.exit(1);
      }

      const chosen = existingApps[idx];
      try {
        const result = await client.regenerateAppKey(chosen.id);
        contfuKey = result.apiKey;
        console.log(`\n✓ New key generated for "${chosen.name}"`);
      } catch (err) {
        handleApiError(err);
      }
    }
  } else {
    // No existing apps — create new
    if (nonInteractive && !opts.appName) {
      console.error("Missing required flag: --app-name");
      process.exit(1);
    }
    contfuKey = await createNewApp(client, opts);
  }

  // Always write key to .env file
  const envPath = opts.envFile ?? ".env";
  writeEnvKey(envPath, contfuKey);
  ensureGitignore();

  console.log("\n✓ Setup complete. Run `contfu status` to verify your configuration.");
}

async function createNewApp(
  client: Awaited<ReturnType<typeof import("../http").getApiClient>>,
  opts: SetupOptions,
): Promise<string> {
  const { handleApiError } = await import("../http");
  let name = opts.appName;
  if (!name) {
    name = await prompt("App name: ");
    if (!name) {
      console.error("Name is required.");
      process.exit(1);
    }
  }
  try {
    console.log();
    const result = await client.createAppConnection(name);
    console.log(`✓ App "${name}" created (id: ${result.id})`);
    return result.apiKey;
  } catch (err) {
    handleApiError(err);
  }
}
