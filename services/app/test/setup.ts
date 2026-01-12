import { beforeEach, mock } from "bun:test";
import { db, userTable } from "~/db/db";
import { stripeMock } from "./mocks";

mock.module("stripe", () => ({
  Stripe: mock(() => stripeMock),
}));

beforeEach(async () => {
  await db.delete(userTable);
});
