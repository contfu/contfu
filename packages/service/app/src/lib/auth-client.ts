import { createAuthClient } from "better-auth/svelte";
import { polarClient } from "@polar-sh/better-auth/client";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:8011",
  plugins: [polarClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
