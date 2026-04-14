import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { getBaseUrl } from "../http";

const CONFIG_PATH = join(homedir(), ".config", "contfu", "config.json");

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

async function loginBrowser(baseUrl: string): Promise<string> {
  const port = await pickPort();
  const state = randomBytes(16).toString("hex");
  const callbackUrl = `http://localhost:${port}/callback`;
  const authUrl = `${baseUrl}/auth/cli?callback=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state)}`;

  const tokenPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        server.close();
        reject(new Error("Login timed out after 5 minutes"));
      },
      5 * 60 * 1000,
    );

    const server = createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
        if (reqUrl.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const token = reqUrl.searchParams.get("token");
        const returnedState = reqUrl.searchParams.get("state");

        if (returnedState !== state) {
          res.writeHead(400);
          res.end("State mismatch");
          clearTimeout(timeout);
          server.close();
          reject(new Error("State mismatch — possible CSRF"));
          return;
        }

        if (!token) {
          res.writeHead(400);
          res.end("No token received");
          clearTimeout(timeout);
          server.close();
          reject(new Error("No token in callback"));
          return;
        }

        res.writeHead(302, { Location: `${baseUrl}/auth/cli/success` });
        res.end();
        clearTimeout(timeout);
        server.close();
        resolve(token);
      } catch (err) {
        res.writeHead(500);
        res.end("Internal error");
        clearTimeout(timeout);
        server.close();
        reject(err);
      }
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
  const authUrl = `${baseUrl}/auth/cli?mode=code`;
  console.log(`Open this URL in your browser:\n\n  ${authUrl}\n`);

  process.stdout.write("Paste the code from the browser: ");
  const code = await new Promise<string>((resolve) => {
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

  const res = await fetch(`${baseUrl}/auth/cli/exchange?code=${encodeURIComponent(code)}`);
  if (!res.ok) {
    throw new Error(`Invalid or expired code (${res.status})`);
  }
  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function login(opts: { noBrowser?: boolean } = {}): Promise<void> {
  const baseUrl = getBaseUrl();
  const useCodeFlow = opts.noBrowser || isHeadless();

  const token = useCodeFlow ? await loginCode(baseUrl) : await loginBrowser(baseUrl);

  await writeConfig({ apiKey: token, baseUrl });
  console.log("Logged in successfully");
}

export async function logout(): Promise<void> {
  try {
    const config = await readConfig();
    delete config.apiKey;
    await writeConfig(config);
    console.log("Logged out");
  } catch {
    console.log("Logged out (no config found)");
  }
}

export async function readConfig(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function writeConfig(config: Record<string, string>): Promise<void> {
  const dir = join(homedir(), ".config", "contfu");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
