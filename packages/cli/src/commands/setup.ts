import { existsSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { getApiKey } from "../http";

export interface SetupOptions {
  package?: string;
  clientName?: string;
  envFile?: string;
  nonInteractive?: boolean;
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

interface SelectOption {
  label: string;
  description: string;
  value: string;
}

async function select(options: SelectOption[]): Promise<string> {
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;

  if (!stdin.isTTY) {
    // Fallback for non-interactive environments
    const answer = await prompt(`Choose (1-${options.length}): `);
    const idx = parseInt(answer, 10) - 1;
    if (idx >= 0 && idx < options.length) return options[idx].value;
    throw new Error("Invalid choice.");
  }

  let selected = 0;

  function render() {
    for (const [i, opt] of options.entries()) {
      const indicator = i === selected ? "❯" : " ";
      const highlight = i === selected ? "\x1b[36m" : "\x1b[2m";
      const reset = "\x1b[0m";
      process.stdout.write(`${highlight}  ${indicator} ${opt.label}${reset}\n`);
      process.stdout.write(`${highlight}    ${opt.description}${reset}\n`);
      if (i < options.length - 1) process.stdout.write("\n");
    }
  }

  function clear() {
    const lines = options.length * 3 - 1;
    for (let i = 0; i < lines; i++) {
      process.stdout.write("\x1b[A\x1b[2K");
    }
  }

  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    render();

    const onData = (key: string) => {
      // Ctrl+C
      if (key === "\x03") {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.exit(130);
      }

      // Enter
      if (key === "\r" || key === "\n") {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        clear();
        const opt = options[selected];
        process.stdout.write(`  ✓ ${opt.label}\n`);
        resolve(opt.value);
        return;
      }

      // Number keys
      const num = parseInt(key, 10);
      if (num >= 1 && num <= options.length) {
        selected = num - 1;
        clear();
        render();
        return;
      }

      // Arrow up / k
      if (key === "\x1b[A" || key === "k") {
        selected = (selected - 1 + options.length) % options.length;
        clear();
        render();
        return;
      }

      // Arrow down / j
      if (key === "\x1b[B" || key === "j") {
        selected = (selected + 1) % options.length;
        clear();
        render();
        return;
      }
    };

    stdin.on("data", onData);
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

function writeEnvKey(envPath: string, key: string): void {
  const line = `\nCONTFU_KEY=${key}\n`;
  appendFileSync(resolve(envPath), line, "utf-8");
  console.log(`✓ CONTFU_KEY written to ${envPath}`);
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

  // 4. Set up client connection
  await setupClientConnection(opts);
}

async function setupClientConnection(opts: SetupOptions): Promise<void> {
  const { getApiClient, handleApiError } = await import("../http");
  const { ConnectionTypeMeta } = await import("@contfu/svc-api");
  const client = getApiClient();
  const nonInteractive = opts.nonInteractive ?? false;

  // Check for existing client connections
  let connections: Awaited<ReturnType<typeof client.listConnections>>;
  try {
    connections = await client.listConnections();
  } catch (err) {
    handleApiError(err);
  }

  const clientTypeId = Object.entries(ConnectionTypeMeta).find(
    ([, meta]) => meta.label === "client",
  )?.[0];
  const existingClients = connections.filter((c) => String(c.type) === clientTypeId);

  let contfuKey: string;

  if (existingClients.length > 0 && nonInteractive) {
    // Non-interactive: use first existing client, generate new key
    const chosen = existingClients[0];
    try {
      const result = await client.regenerateClientKey(chosen.id);
      contfuKey = result.apiKey;
      console.log(`✓ New key generated for existing client "${chosen.name}" (id: ${chosen.id})`);
    } catch (err) {
      handleApiError(err);
    }
  } else if (existingClients.length > 0) {
    // Interactive: offer create new or use existing
    console.log("How do you want to connect this app?\n");

    const options: SelectOption[] = [
      {
        label: "Create a new client",
        description: "Creates a new client connection and generates an API key",
        value: "new",
      },
      {
        label: "Use an existing client (generate new key)",
        description: "Pick from your existing clients and generate a fresh API key",
        value: "existing-regenerate",
      },
    ];

    const choice = await select(options);

    if (choice === "new") {
      contfuKey = await createNewClient(client, opts);
    } else {
      console.log("\nYour client connections:\n");
      for (const [i, c] of existingClients.entries()) {
        console.log(`  ${i + 1}. ${c.name} (id: ${c.id})`);
      }
      console.log();

      const pick = await prompt(`Choose (1-${existingClients.length}): `);
      const idx = parseInt(pick, 10) - 1;
      if (idx < 0 || idx >= existingClients.length) {
        console.error("Invalid choice.");
        process.exit(1);
      }

      const chosen = existingClients[idx];
      try {
        const result = await client.regenerateClientKey(chosen.id);
        contfuKey = result.apiKey;
        console.log(`\n✓ New key generated for "${chosen.name}"`);
      } catch (err) {
        handleApiError(err);
      }
    }
  } else {
    // No existing clients — create new
    if (nonInteractive && !opts.clientName) {
      console.error("Missing required flag: --client-name");
      process.exit(1);
    }
    contfuKey = await createNewClient(client, opts);
  }

  // Key placement
  if (opts.envFile) {
    writeEnvKey(opts.envFile, contfuKey);
  } else if (nonInteractive) {
    console.log(`\nCONTFU_KEY=${contfuKey}\n`);
    console.log("Set this as the CONTFU_KEY environment variable in your app.");
  } else {
    console.log("\nHow do you want to store the CONTFU_KEY?\n");
    const placement = await select([
      {
        label: "Write to .env file",
        description: "Appends CONTFU_KEY=... to .env in the current directory",
        value: "env",
      },
      {
        label: "Print only",
        description: "Show the key so you can store it yourself",
        value: "print",
      },
    ]);

    if (placement === "env") {
      writeEnvKey(".env", contfuKey);
      // Ensure .env is gitignored
      const gitignorePath = join(process.cwd(), ".gitignore");
      if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, "utf-8");
        if (!content.includes(".env")) {
          appendFileSync(gitignorePath, "\n.env\n", "utf-8");
          console.log("✓ Added .env to .gitignore");
        }
      }
    } else {
      console.log(`\nCONTFU_KEY=${contfuKey}\n`);
      console.log(
        "Set this as the CONTFU_KEY environment variable in your app. You can use a .env file,",
      );
      console.log("a secrets manager, or any other method your deployment supports.");
    }
  }

  console.log("\n✓ Setup complete. Run `contfu status` to verify your configuration.");
}

async function createNewClient(
  client: Awaited<ReturnType<typeof import("../http").getApiClient>>,
  opts: SetupOptions,
): Promise<string> {
  const { handleApiError } = await import("../http");
  let name = opts.clientName;
  if (!name) {
    name = await prompt("Client name: ");
    if (!name) {
      console.error("Name is required.");
      process.exit(1);
    }
  }
  try {
    console.log();
    const result = await client.createClientConnection(name);
    console.log(`✓ Client "${name}" created (id: ${result.id})`);
    return result.apiKey;
  } catch (err) {
    handleApiError(err);
  }
}
