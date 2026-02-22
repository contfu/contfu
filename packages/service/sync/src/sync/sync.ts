import { combine2ints } from "../util/numbers/numbers";

export const [compressConsumerId, expandConsumerId] = combine2ints(32, 20);
export const [compressCollectionId, expandCollectionId] = combine2ints(32, 20);
