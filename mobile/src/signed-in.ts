/**
 * Who is using the app: somebody signed in (the sign-in client's session), or the account an API key acts as
 * (./key-access.ts). Every screen asks this, in the shape of the sign-in client's own answer, so a screen reads
 * `session` the same way in both. A kept key wins: the phone uses one or the other, never both.
 */
import { useMemo } from "react";
import { authClient } from "./auth";
import { useKeyAccess } from "./key-access";

export type SignedIn = {
  user: { id: string; name?: string | null; email?: string | null };
  /** True when an API key is in use. */
  viaKey?: boolean;
};

export function useSignedIn(): {
  data: SignedIn | null;
  isPending: boolean;
  refetch: () => void;
} {
  const { data: session, isPending, refetch } = authClient.useSession();
  const { access, loaded } = useKeyAccess();
  // The same object while nothing changed, so effects that depend on it don't run on every render.
  const data = useMemo<SignedIn | null>(() => {
    if (access)
      return {
        user: {
          id: `key:${access.server}:${access.organization}`,
          name: access.organizationName ?? null,
        },
        viaKey: true,
      };
    return session
      ? {
          user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
          },
        }
      : null;
  }, [access, session]);
  if (!loaded) return { data: null, isPending: true, refetch };
  return { data, isPending: access ? false : isPending, refetch };
}
