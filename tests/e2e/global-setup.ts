/**
 * Shared global setup for E2E tests.
 *
 * Starts a single service app instance that all test files share,
 * eliminating redundant PGLite DB init + migration + seeding per file.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

export const SERVICE_PORT = 8011;
export const SERVICE_URL = `http://localhost:${SERVICE_PORT}`;

const processes: ChildProcess[] = [];

async function spawnProcess(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs = 60000,
  readyUrl?: string,
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Process did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);

    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    processes.push(proc);
    let isReady = false;

    const markReady = () => {
      if (!isReady) {
        isReady = true;
        clearTimeout(timeout);
        resolve(proc);
      }
    };

    proc.stdout?.on("data", (data: Buffer) => {
      if (process.env.CI) process.stdout.write(`[service] ${data}`);
    });
    proc.stderr?.on("data", (data: Buffer) => {
      if (process.env.CI) process.stderr.write(`[service] ${data}`);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on("exit", (code) => {
      if (code !== 0 && code !== null && !isReady) {
        clearTimeout(timeout);
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    if (readyUrl) {
      const pollUrl = async () => {
        const pollStart = Date.now();
        while (Date.now() - pollStart < timeoutMs && !isReady) {
          try {
            const response = await fetch(readyUrl);
            if (response.ok || response.status === 404 || response.status === 500) {
              markReady();
              return;
            }
          } catch {
            // Server not ready
          }
          await sleep(50);
        }
      };
      void pollUrl();
    }
  });
}

async function killAllProcesses(): Promise<void> {
  for (const proc of processes) {
    if (proc.pid && !proc.killed) {
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch {
        proc.kill("SIGTERM");
      }
    }
  }
  processes.length = 0;
  await sleep(1000);
}

async function globalSetup() {
  const uniqueDbDir = `/tmp/contfu-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  console.log("[global-setup] Starting shared service app...");
  await spawnProcess(
    "bun",
    ["build/index.js"],
    resolve(PROJECT_ROOT, "packages/service/app"),
    {
      PORT: String(SERVICE_PORT),
      ORIGIN: SERVICE_URL,
      TEST_MODE: "true",
      PGLITE_DATA_DIR: uniqueDbDir,
      BETTER_AUTH_SECRET: "e2e-test-secret-at-least-32-chars-long",
    },
    60000,
    SERVICE_URL,
  );
  console.log("[global-setup] Service app started");

  // Store URL in env for test files to read
  process.env.E2E_SERVICE_URL = SERVICE_URL;

  // Return teardown function
  return async () => {
    console.log("[global-teardown] Stopping shared service app...");
    await killAllProcesses();
  };
}

export default globalSetup;
