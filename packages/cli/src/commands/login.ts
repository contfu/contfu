import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { BASE_URL } from "../http";
import { printDryRun, type DryRunOption } from "./dry-run";

function configDir(): string {
  return process.env.CONTFU_CONFIG_DIR ?? join(homedir(), ".config", "contfu");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const [cmd, args] =
    platform === "darwin"
      ? (["open", [url]] as const)
      : platform === "win32"
        ? (["cmd", ["/c", "start", "", url]] as const)
        : (["xdg-open", [url]] as const);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

function pickPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close((err) => {
        if (err) reject(err);
        else resolve((addr as { port: number }).port);
      });
    });
  });
}

function isHeadless(): boolean {
  return !!(process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.SSH_TTY);
}

const AUTH_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

function authorizationUrl(
  baseUrl: string,
  challenge: string,
  options: { callback?: string; code?: boolean },
): string {
  const url = new URL("/auth/cli", baseUrl);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (options.code) url.searchParams.set("mode", "code");
  if (options.callback) url.searchParams.set("callback", options.callback);
  return url.toString();
}

async function exchangeCode(
  baseUrl: string,
  code: string,
  state: string,
  verifier: string,
): Promise<string> {
  if (!AUTH_VALUE_PATTERN.test(code) || !AUTH_VALUE_PATTERN.test(state)) {
    throw new Error("Invalid authorization response");
  }

  const res = await fetch(new URL("/auth/cli/exchange", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state, code_verifier: verifier }),
  });
  if (!res.ok) {
    throw new Error(`Invalid or expired authorization (${res.status})`);
  }
  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new Error("No token received from authorization exchange");
  return token;
}

async function loginBrowser(baseUrl: string): Promise<string> {
  const port = await pickPort();
  const { verifier, challenge } = createPkce();
  const callbackUrl = `http://localhost:${port}/callback`;
  const authUrl = authorizationUrl(baseUrl, challenge, { callback: callbackUrl });

  const tokenPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        server.close();
        reject(new Error("Login timed out after 5 minutes"));
      },
      5 * 60 * 1000,
    );

    const finish = (error?: unknown) => {
      clearTimeout(timeout);
      server.close();
      if (error) reject(error);
    };

    const server = createServer((req, res) => {
      void (async () => {
        try {
          const reqUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
          if (reqUrl.pathname !== "/callback") {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          const code = reqUrl.searchParams.get("code");
          const state = reqUrl.searchParams.get("state");
          if (!code || !state) {
            res.writeHead(400);
            res.end("Invalid authorization response");
            finish(new Error("No authorization code or state in callback"));
            return;
          }

          const token = await exchangeCode(baseUrl, code, state, verifier);
          res.writeHead(302, { Location: `${baseUrl}/auth/cli/success` });
          res.end();
          clearTimeout(timeout);
          server.close();
          resolve(token);
        } catch (err) {
          res.writeHead(500);
          res.end("Authorization exchange failed");
          finish(err);
        }
      })();
    });

    server.listen(port, "127.0.0.1");
  });

  console.log(`Opening browser to ${authUrl}`);
  try {
    await openBrowser(authUrl);
  } catch {
    console.log(`Could not open browser automatically. Please visit:\n  ${authUrl}`);
  }

  return tokenPromise;
}

async function loginCode(baseUrl: string): Promise<string> {
  const { verifier, challenge } = createPkce();
  const authUrl = authorizationUrl(baseUrl, challenge, { code: true });
  console.log(`Open this URL in your browser:\n\n  ${authUrl}\n`);

  process.stdout.write("Paste the authorization value from the browser: ");
  const authorization = await new Promise<string>((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    let buf = "";
    process.stdin.on("data", (chunk) => {
      buf += chunk;
      const line = buf.split("\n")[0].trim();
      if (line) {
        process.stdin.pause();
        resolve(line);
      }
    });
  });

  const [code, state, ...extra] = authorization.split(".");
  if (extra.length > 0 || !code || !state) {
    throw new Error("Invalid authorization value");
  }
  return exchangeCode(baseUrl, code, state, verifier);
}

export async function login(opts: { noBrowser?: boolean } = {}): Promise<void> {
  const baseUrl = BASE_URL;
  const useCodeFlow = opts.noBrowser || isHeadless();

  const token = useCodeFlow ? await loginCode(baseUrl) : await loginBrowser(baseUrl);

  await writeConfig({ apiKey: token, baseUrl });
  console.log("Logged in successfully");
}

export async function logout(options: DryRunOption = {}): Promise<void> {
  try {
    const config = await readConfig();
    if (options.dryRun) {
      printDryRun("clear stored credentials", { configPath: configPath() });
      return;
    }
    delete config.apiKey;
    await writeConfig(config);
    console.log("Logged out");
  } catch {
    console.log("Logged out (no config found)");
  }
}

export async function readConfig(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(configPath(), "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function writeConfig(config: Record<string, string>): Promise<void> {
  await fs.mkdir(configDir(), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2) + "\n", "utf-8");
}
