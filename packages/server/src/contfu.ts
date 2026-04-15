import { contfu as createContfu, getFileStore, getMediaOptimizer } from "@contfu/contfu";

const fileStore = await getFileStore();
const mediaOptimizer = await getMediaOptimizer();

// oxlint-disable-next-line typescript/unbound-method
export const { query, events, handleFileRequest } = createContfu({
  fileStore,
  mediaOptimizer,
});
