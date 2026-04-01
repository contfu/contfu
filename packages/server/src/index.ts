import { createServeOptions, type ServerOptions } from "./server";

export type { ServerOptions } from "./server";
export { createServeOptions } from "./server";

export default function serve(opts: ServerOptions = {}) {
  return Bun.serve(createServeOptions(opts));
}
