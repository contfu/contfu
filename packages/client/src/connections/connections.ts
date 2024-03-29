import { updateConnections } from "./data/connection-repository";

export async function setConnections(connections: Connection[]): Promise<void> {
  await updateConnections(connections);
}

export type Connection = {
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
   * Loads all ids of the collection from the connection target.
   *
   * @param collection The collection to get references for.
   */
  getCollectionRefs(collection: string): Promise<void>;
  /**
   * Pulls all content from the connection target.
   */
  pull(): Promise<void>;
  /**
   * Pulls only recently changed content from the connection target.
   */
  pullRecent(): Promise<void>;
};
