import { defineEnum, type EnumValue } from "@contfu/core";

/** Authentication types for web sources. */
export const WebAuthType = defineEnum({
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
});
/** Type representing valid WebAuthType values. */

export type WebAuthType = EnumValue<typeof WebAuthType>;
