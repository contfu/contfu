// Set PGLITE_DATA_DIR to trigger PGLite in db.ts (empty path = in-memory).
// We use PGLITE_DATA_DIR instead of NODE_ENV because Vite inlines process.env.NODE_ENV.
process.env.PGLITE_DATA_DIR = ":memory:";
