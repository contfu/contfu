import { plugin } from "bun";

await plugin({
  name: "svelte loader",
  async setup(build) {
    const { compile, compileModule } = await import("svelte/compiler");
    const transpiler = new Bun.Transpiler({ loader: "ts" });

    // Helper to normalize file:// URLs to paths
    const toPath = (u: string) => (u.startsWith("file://") ? new URL(u).pathname : u);

    // Locate Svelte package and build a regex that matches any ".../src/**/index-server.js"
    const pkgUrl = await import.meta.resolve("svelte/package.json");
    const pkgPath = toPath(pkgUrl);
    const pkgDir = pkgPath.slice(0, pkgPath.lastIndexOf("/"));
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const serverAnyRe = new RegExp("^" + escape(pkgDir) + "/src/(.*)index-server\\.js$");

    // Redirect server runtime files to their client counterparts
    build.onLoad({ filter: serverAnyRe }, async ({ path }) => {
      const clientPath = path.replace(/index-server\.js$/, "index-client.js");
      const code = await Bun.file(clientPath).text();
      return { contents: code, loader: "js" };
    });

    // Compile Svelte SFCs
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const filePath = path.split("?")[0]!;
      const source = await Bun.file(filePath).text();

      const { js } = compile(source, {
        filename: filePath,
        generate: "client",
        dev: true,
      });

      return { contents: js.code, loader: "js" };
    });

    // Compile JS/TS modules that contain Svelte runes (e.g. modern.svelte.js)
    build.onLoad({ filter: /\.svelte\.(js|ts)$/ }, async ({ path }) => {
      const filePath = path.split("?")[0]!;
      const source = await Bun.file(filePath).text();
      const isTs = filePath.endsWith(".ts");
      const normalizedSource = isTs
        ? transpiler.transformSync(source, {
            loader: "ts",
            sourcefile: filePath,
          })
        : source;
      const code =
        typeof normalizedSource === "string"
          ? normalizedSource
          : (normalizedSource as { code: string }).code;

      const { js } = compileModule(code, {
        filename: filePath,
        generate: "client",
        dev: true,
      });

      return { contents: js.code, loader: "js" };
    });
  },
});
