import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const isUnderConstruction = !process.env.STRIPE_TEST_KEY && !process.env.STRIPE_KEY;
  const user = locals.session?.user;

  return {
    user: user ? { email: user.email, name: user.name, image: user.image } : null,
    isUnderConstruction,
  };
};
