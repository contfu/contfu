import { plugin } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dir.replace(/\/test$/, "");

function resolveTs(path: string): string {
  if (existsSync(path)) return path;
  if (existsSync(`${path}.ts`)) return `${path}.ts`;
  if (existsSync(`${path}.js`)) return `${path}.js`;
  if (existsSync(`${path}.svelte`)) return `${path}.svelte`;
  return path;
}

plugin({
  name: "svelte-kit-test-aliases",
  setup(build) {
    build.onResolve({ filter: /^\$lib\/(.*)$/ }, (args) => ({
      path: resolveTs(join(root, "src/lib", args.path.slice(5))),
    }));
    build.onResolve({ filter: /^\$app\/server$/ }, () => ({
      path: join(root, "test/mocks/app-server.ts"),
    }));
  },
});
