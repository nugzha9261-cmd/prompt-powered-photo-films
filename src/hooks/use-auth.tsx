import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { setPurchaseUser } from "@/lib/revenuecat";

const AFTER_AUTH_KEY = "lumiere:after-auth";

type AuthState = { session: Session | null; ready: boolean; signOut: () => Promise<void> };

const AuthContext = createContext<AuthState>({
  session: null,
  ready: false,
  signOut: async () => {},
});

/** Remember where to go once a sign-in that leaves the page (e.g. Google) comes back. */
export function rememberAfterAuth(path: "/studio" | "/library") {
  sessionStorage.setItem(AFTER_AUTH_KEY, path);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      void setPurchaseUser(data.session?.user.id ?? null).catch(() => {});
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        void setPurchaseUser(next?.user.id ?? null).catch(() => {});
      }
      setSession(next);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // Defer: calling auth methods (route guards, queries) inside this callback deadlocks the auth client.
      setTimeout(() => {
        void router.invalidate();
        if (event === "SIGNED_OUT") return;
        void queryClient.invalidateQueries();
        if (event === "SIGNED_IN") {
          const target = sessionStorage.getItem(AFTER_AUTH_KEY);
          sessionStorage.removeItem(AFTER_AUTH_KEY);
          if (target === "/studio" || target === "/library") void navigate({ to: target });
        }
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [router, navigate, queryClient]);

  const signOut = useCallback(async () => {
    await setPurchaseUser(null).catch(() => {});
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);

  return <AuthContext.Provider value={{ session, ready, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
