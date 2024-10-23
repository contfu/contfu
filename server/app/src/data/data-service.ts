import { DbConsumer } from "../access/db/access-schema";
import { connectConsumer } from "./data-repository";

export function subscribeConsumerToCollections({ id, accountId }: DbConsumer) {
  return connectConsumer({ id, accountId });
}
