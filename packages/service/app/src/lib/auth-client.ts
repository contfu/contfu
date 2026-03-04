import { polarClient } from "@polar-sh/better-auth/client";
import { apiKeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
  plugins: [polarClient(), apiKeyClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
