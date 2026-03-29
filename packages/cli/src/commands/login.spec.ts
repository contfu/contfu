import { describe, test, expect, mock, beforeEach } from "bun:test";

// We test the config read/write logic by directly importing the helpers
// and mocking fs.promises.

const mockReadFile = mock((_path: string, _enc: string) => Promise.resolve("{}"));
const mockWriteFile = mock(() => Promise.resolve());
const mockMkdir = mock(() => Promise.resolve());

void mock.module("node:fs", () => ({
  ...require("node:fs"),
  promises: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
  },
}));

// Import after mocking
const { readConfig, writeConfig, logout } = await import("./login");

beforeEach(() => {
  mockReadFile.mockReset();
  mockWriteFile.mockReset();
  mockMkdir.mockReset();
});

describe("readConfig", () => {
  test("returns parsed JSON when file exists", async () => {
    mockReadFile.mockImplementation(() =>
      Promise.resolve(JSON.stringify({ apiKey: "test-key", baseUrl: "https://contfu.com" })),
    );
    const config = await readConfig();
    expect(config.apiKey).toBe("test-key");
    expect(config.baseUrl).toBe("https://contfu.com");
  });

  test("returns empty object when file does not exist", async () => {
    mockReadFile.mockImplementation(() => Promise.reject(new Error("ENOENT")));
    const config = await readConfig();
    expect(config).toEqual({});
  });
});

describe("writeConfig", () => {
  test("writes config as formatted JSON", async () => {
    mockMkdir.mockImplementation(() => Promise.resolve());
    mockWriteFile.mockImplementation(() => Promise.resolve());

    await writeConfig({ apiKey: "my-key", baseUrl: "https://contfu.com" });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const written = (mockWriteFile.mock.calls[0] as unknown[])[1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.apiKey).toBe("my-key");
    expect(parsed.baseUrl).toBe("https://contfu.com");
  });
});

describe("logout", () => {
  test("removes apiKey from config", async () => {
    mockReadFile.mockImplementation(() =>
      Promise.resolve(JSON.stringify({ apiKey: "old-key", baseUrl: "https://contfu.com" })),
    );
    mockMkdir.mockImplementation(() => Promise.resolve());
    mockWriteFile.mockImplementation(() => Promise.resolve());

    await logout();

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const written = (mockWriteFile.mock.calls[0] as unknown[])[1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.baseUrl).toBe("https://contfu.com");
  });

  test("does not throw when config file does not exist", async () => {
    mockReadFile.mockImplementation(() => Promise.reject(new Error("ENOENT")));
    mockMkdir.mockImplementation(() => Promise.resolve());
    mockWriteFile.mockImplementation(() => Promise.resolve());

    await logout();
  });
});
