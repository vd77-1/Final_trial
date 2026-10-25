import { getBackend } from "./backend";
import { useAuthUser } from "./store";
import type { UserRole } from "@/data/types";

export const signIn = (email: string, password: string) => getBackend().signIn(email, password);
export const signOut = () => getBackend().signOut();

/** Re-export so pages import auth things from one place. */
export function useAuth() {
  const user = useAuthUser();
  return { user, loading: user === undefined, role: user?.role as UserRole | undefined };
}
