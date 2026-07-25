import type { MediaMasterConfig } from "../../domain/media";
import { DBStore } from "./db-store";

export const fileStore = new DBStore();

export const mediaMasterDefaults: MediaMasterConfig = {
  image: { mediaType: "image", format: "avif", quality: 90 },
  video: {
    mediaType: "video",
    format: "mp4",
    ext: "mp4",
    videoCodec: "libx264",
    audioCodec: "aac",
  },
  audio: { mediaType: "audio", format: "opus", ext: "opus", codec: "libopus", bitrate: "160k" },
};
