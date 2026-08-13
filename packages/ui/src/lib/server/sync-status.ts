export type SyncIntegrationState = "disabled" | "connecting" | "syncing" | "connected" | "error";

export type SyncStatus = {
  state: SyncIntegrationState;
  reason: string | null;
};
