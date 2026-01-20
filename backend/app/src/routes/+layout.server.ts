import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const isUnderConstruction = !process.env.POLAR_ACCESS_TOKEN;
  const user = locals.user;

  return {
    user: user ? { email: user.email, name: user.name, image: user.image ?? undefined } : null,
    isUnderConstruction,
  };
};
