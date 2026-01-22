import { ConnectionConfig } from "@contfu/core";

type ContfuSetupOpts = {
  /**
   * The database URL to use for the database connection.
   */
  databaseUrl: string;
  /**
   * The connections to set up.
   * If connections change their key or target, the old connection and all linked data
   * will be removed and a new one created.
   * Can also be set later with `setConnections`.
   */
  connections?: ConnectionConfig<any>[];
};

export async function setup({ connections }: ContfuSetupOpts) {
  if (connections) {
    const { setConnections } = await import("./sync/connections");
    await setConnections(connections);
  }
}
