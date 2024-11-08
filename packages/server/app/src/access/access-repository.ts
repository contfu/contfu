import * as ds from "./db/access-datasource";

export {
  authenticateConsumer,
  createConsumer,
  verifyUserCredentials,
} from "./db/access-datasource";

export async function createUser(email: string) {
  return ds.createUser(
    email,
    {
      maxSources: 10,
      maxCollections: 10,
      maxItems: 1000,
      maxClients: 10,
    },
    Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
  );
}
