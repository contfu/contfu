export type SyncConnectionState = "disabled" | "connecting" | "connected" | "error";

export type SyncStatus = {
  state: SyncConnectionState;
  reason: string | null;
};

let status: SyncStatus = { state: "disabled", reason: null };

export function setSyncStatus(next: SyncStatus) {
  status = next;
}

export function getSyncStatus(): SyncStatus {
  return status;
}
