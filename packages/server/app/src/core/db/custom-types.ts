import { customType } from "drizzle-orm/sqlite-core";

export const buffer = customType<{ data: Buffer }>({
  dataType: () => "BLOB",
  fromDriver: (value) => Buffer.from(value as Uint8Array),
});
