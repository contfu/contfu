import { getMediaMaster } from "./getMediaMaster";

export function loadMediaMasterSource(fileId: string, fallback: Buffer | null): Buffer | null {
  const master = getMediaMaster(fileId);
  return master?.data ?? fallback;
}
