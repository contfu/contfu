import { isHttpError } from "@sveltejs/kit";
import { toast } from "svelte-sonner";

export async function tcToast<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    toast.error(isHttpError(error) ? error.body.message : "An unknown error occurred");
  }
}
