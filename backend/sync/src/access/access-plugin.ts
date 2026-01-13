import Elysia, { t } from "elysia";
import { verifyUserCredentials } from "./access-repository";

export const accessPlugin = ({ prefix = "/api/access" }) =>
  new Elysia({ prefix }).post(
    "/authenticate",
    async ({ body, error }) => {
      const activeUntil = await verifyUserCredentials(body.email, body.password);
      if (!activeUntil) return error(401, "Invalid credentials");
      return { activeUntil };
    },
    { body: t.Object({ email: t.String(), password: t.String() }) },
  );
