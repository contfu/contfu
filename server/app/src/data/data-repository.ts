import * as accessDs from "../access/db/access-datasource";
import { DbConsumer } from "../access/db/access-schema";
import * as ds from "./db/data-datasource";

const ID = Number(Bun.env.ID ?? 1);

export {
  createConsumerCollectionConnection as connectConsumerToCollection,
  createCollection,
  createSource,
  getSourcesByIds,
} from "./db/data-datasource";

export async function connectConsumer({
  id,
  accountId,
}: Pick<DbConsumer, "id" | "accountId">) {
  const [, connections] = await Promise.all([
    accessDs.updateConsumer({ id, accountId, connectedTo: ID }),
    ds.getCollectionsForConsumer(accountId, id),
  ]);
  return connections;
}
