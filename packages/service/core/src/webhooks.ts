export type WebhookLogStatus = "success" | "error" | "unauthorized";

export type WebhookLogEntry = {
  id: number;
  event: string;
  model: string | null;
  status: WebhookLogStatus;
  errorMessage: string | null;
  itemsBroadcast: number;
  timestamp: Date;
};
