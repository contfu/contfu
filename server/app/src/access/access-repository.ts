import * as ds from "./db/access-datasource";

export { authenticateClient } from "./db/access-datasource";

export async function createAccount(email: string) {
  return ds.createAccount(
    email,
    {
      maxSources: 10,
      maxCollections: 10,
      maxItems: 1000,
      maxClients: 10,
    },
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10)
  );
}

export async function createClient(accountId: number, name?: string) {
  return ds.createClient(accountId, name);
}
