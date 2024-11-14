import { mock } from "bun:test";
import { stripeMock } from "./mocks";

mock.module("stripe", () => ({
  Stripe: mock(() => stripeMock),
}));
