import type { UserRole } from "@contfu/svc-backend/domain/types";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => {
  const isUnderConstruction = !process.env.POLAR_ACCESS_TOKEN;
  const user = locals.user;

  return {
    user: user
      ? {
          email: user.email,
          name: user.name,
          image: user.image ?? undefined,
          role: (user.role ?? undefined) as UserRole | undefined,
        }
      : null,
    isUnderConstruction,
  };
};
