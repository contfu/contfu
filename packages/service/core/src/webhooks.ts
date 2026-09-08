export type WebhookLogStatus =
  | "success"
  | "error"
  | "unauthorized"
  | "ingress_accepted"
  | "ingress_buffered"
  | "ingress_rejected";

export type WebhookLogEntry = {
  id: number;
  event: string;
  model: string | null;
  status: WebhookLogStatus;
  errorMessage: string | null;
  itemsBroadcast: number;
  timestamp: Date;
};
