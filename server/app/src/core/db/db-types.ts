import { customType } from "drizzle-orm/pg-core";

export const bytea = customType<{
  data: Buffer;
  notNull: false;
  default: false;
}>({
  dataType() {
    return "bytea";
  },
  toDriver(val: Buffer) {
    return val;
  },
  fromDriver(val: unknown) {
    return Buffer.from(val as Uint8Array);
  },
});
