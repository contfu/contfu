import { mock } from "bun:test";

// Polar SDK mock
export const polarMock = {
  customers: {
    create: mock(),
    get: mock(),
  },
  checkouts: {
    create: mock(),
  },
};
