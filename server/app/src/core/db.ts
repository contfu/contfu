export const { withSchema, db } =
  process.env.NODE_ENV === "production"
    ? await import("./db/postgres")
    : await import("./db/pglite");
