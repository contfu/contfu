import { ConnectionConfig } from "@contfu/core";
import { Dialect } from "kysely";
import { setupDb } from "./core/db/db";

export { getDb, migrationProvider, setupDb, truncate } from "./core/db/db";

type ContfuSetupOpts = {
  /**
   * The kysely dialect to use for the database connection.
   */
  kyselyDialect: Dialect;
  /**
   * The connections to set up.
   * If connections change their key or target, the old connection and all linked data
   * will be removed and a new one created.
   * Can also be set later with `setConnections`.
   */
  connections?: ConnectionConfig<any>[];
};

export async function setup({ connections, kyselyDialect }: ContfuSetupOpts) {
  await setupDb({ dialect: kyselyDialect });
  if (connections) await setConnections(connections);
}
