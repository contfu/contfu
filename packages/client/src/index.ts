import { Dialect } from "kysely";
import { Connection, setConnections } from "./connections/connections";
import { setupDb } from "./core/db/db";

export * from "./blocks/blocks";
export * from "./connections/connections";
export { getDb, migrationProvider, setupDb } from "./core/db/db";
export * from "./pages/pages";

type ContfuSetupOpts = {
  /**
   * The kysely dialect to use for the database connection.
   */
  kyselyDialect: Dialect;
  /**
   * Whether to erase the database before setting up the connections.
   * @default false
   */
  eraseDb?: boolean;
  /**
   * The connections to set up.
   * If connections change their key or target, the old connection and all linked data
   * will be removed and a new one created.
   */
  connections: Connection[];
};

export async function setup({
  connections,
  kyselyDialect,
  eraseDb,
}: ContfuSetupOpts) {
  setupDb({ dialect: kyselyDialect, erase: eraseDb });
  await setConnections(connections);
}
