import { PageData } from "../pages/data/page-data";
import { updateConnections } from "./data/connection-repository";

export async function setConnections(connections: Connection[]): Promise<void> {
  await updateConnections(connections);
}

export type Connection<Collection extends string = string> = {
  /**
   * The id of the connection. It is unique and auto-incremented. It is used to
   * reference the connection in the database.
   */
  id: number;
  /**
   * The name of the connection. It identies the connection and if it changes,
   * all related content will be removed and re-synchronized.
   */
  name: string;
  /**
   * The API key to use for the connection.
   */
  key?: string;
  /**
   * The target of the connection. It is a URL.
   */
  target?: string;
  /**
   * The type of the connection. It is determined by the concrete connection implementation.
   */
  type: string;
  /**
   * The interval in seconds in which content shall be removed, if they don't exist
   * on the target anymore.
   */
  pruneInterval?: number;
  /**
   * The interval in minutes in which all content shall be synchronized with the
   * target.
   */
  pullInterval?: number;
  /**
   * The interval in minutes in which only recently changed content shall be
   * synchronized with the target.
   */
  pullRecentInterval?: number;
  /**
   * The collections to synchronize with the connection.
   */
  collectionNames: Collection[];
  /**
   * Loads all ids of the collection from the connection target.
   *
   * @param collection The collection to get references for.
   */
  pullCollectionRefs(collection: Collection): AsyncGenerator<string[]>;
  /**
   * Pulls content from the connection target.
   */
  pull(collection: Collection): AsyncGenerator<Omit<PageData, "id">>;
};
