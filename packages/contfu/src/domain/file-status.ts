import { defineEnum, type EnumValue } from "@contfu/core";

export const FileStatus = defineEnum({
  Pending: 1,
  Ready: 2,
  Failed: 3,
});

export type FileStatus = EnumValue<typeof FileStatus>;
export type FileStatusName = "pending" | "ready" | "failed";

export function fileStatusToName(status: number): FileStatusName {
  if (status === FileStatus.Pending) return "pending";
  if (status === FileStatus.Ready) return "ready";
  return "failed";
}

export function fileStatusFromName(status: FileStatusName): FileStatus {
  if (status === "pending") return FileStatus.Pending;
  if (status === "ready") return FileStatus.Ready;
  return FileStatus.Failed;
}
