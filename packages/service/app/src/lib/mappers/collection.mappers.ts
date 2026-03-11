import type { ServiceCollection } from "@contfu/svc-core";
import type { BackendCollection } from "@contfu/svc-backend/domain/types";
import { encodeId } from "@contfu/svc-backend/infra/ids";

export function encodeCollection({
  id,
  connectionId,
  ...rest
}: BackendCollection): ServiceCollection {
  return {
    ...rest,
    id: encodeId("collection", id),
    connectionId: connectionId !== null ? encodeId("connection", connectionId) : null,
  };
}
