import { updateConnections } from "./data/connection-repository";

export async function setConnections(connections: Connection[]): Promise<void> {
  await updateConnections(connections);
}

export type Connection = {
  name: string;
  key: string;
  target: string;
  type: string;
  getCollectionRefs(collection: string): Promise<void>;
  pull(): Promise<void>;
  pullRecent(): Promise<void>;
};
