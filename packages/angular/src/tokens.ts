import { InjectionToken } from "@angular/core";
import type { FileUrlOptions } from "@contfu/core";

export const CONTFU_FILE_URL = new InjectionToken<FileUrlOptions>("CONTFU_FILE_URL");
