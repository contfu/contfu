export interface ServiceSourceCollection {
  id: string;
  sourceId: string;
  name: string;
  hasRef: boolean;
  refString: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface ServiceSourceCollectionWithConnectionCount extends ServiceSourceCollection {
  connectionCount: number;
}

export interface ServiceSourceCollectionSummary {
  id: string;
  name: string;
  refString: string | null;
  connectionCount: number;
  createdAt: Date;
}
