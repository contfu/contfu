import { plugin } from "bun";
import { compile } from "svelte/compiler";
import { readFileSync } from "node:fs";

plugin({
  name: "svelte",
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, ({ path }) => {
      const source = readFileSync(path, "utf-8");
      const { js } = compile(source, {
        filename: path,
        generate: "server",
      });
      return {
        contents: js.code,
        loader: "js",
      };
    });
  },
});
