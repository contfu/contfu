import {
  contfu as createContfu,
  createDatabaseClient,
  getFileStore,
  getMediaOptimizer,
} from "@contfu/contfu";

/** Create an isolated Contfu runtime instance for one Server process. */
export async function createServerContfu(
  database?: Awaited<ReturnType<typeof createDatabaseClient>>,
) {
  const [fileStore, mediaOptimizer] = await Promise.all([getFileStore(), getMediaOptimizer()]);
  return createContfu({ fileStore, mediaOptimizer, database });
}
