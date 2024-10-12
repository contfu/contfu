import * as accessDs from "../access/db/access-datasource";
import { Client } from "../access/db/access-schema";
import * as ds from "./db/data-datasource";

const ID = Number(Bun.env.ID ?? 1);

export {
  createCollection,
  createSource,
  getSourcesByIds,
} from "./db/data-datasource";

export async function connectClient({
  id,
  accountId,
}: Pick<Client, "id" | "accountId">) {
  const [, connections] = await Promise.all([
    accessDs.updateClient({ id, accountId, connectedTo: ID }),
    ds.getCollectionsForClient(accountId, id),
  ]);
  return connections;
}

export async function connectClientToCollection(
  accountId: number,
  clientId: number,
  collectionId: number
) {
  return ds.createClientCollectionConnection(accountId, clientId, collectionId);
}
