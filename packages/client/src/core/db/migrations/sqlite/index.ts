import { MigrationProvider } from "kysely";
import * as m001 from "./001_initial-schema";

export const sqliteMigrationProvider: MigrationProvider = {
  async getMigrations() {
    return {
      "001": m001,
    };
  },
};
