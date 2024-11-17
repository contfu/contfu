import { component$ } from "@builder.io/qwik";
import type { DisplayUser } from "~/server/auth/session";

export default component$(({ user }: { user: DisplayUser }) => {
  return user.image ? (
    <img
      class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 ring-1 ring-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 dark:ring-indigo-400"
      src={user.image}
      width={32}
      height={32}
      alt={user.name}
    />
  ) : (
    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 ring-1 ring-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 dark:ring-indigo-400">
      {user.name[0].toUpperCase()}
    </div>
  );
});
