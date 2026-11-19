import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const creditsKey = ["credits"] as const;
const PAYWALL_EVENT = "lumiere:paywall";

export function useCredits() {
  const { session } = useAuth();
  return useQuery({
    queryKey: creditsKey,
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_credits").select("balance, last_daily_claim").maybeSingle();
      if (error) throw error;
      return { balance: data?.balance ?? 0, lastClaim: data?.last_daily_claim ?? null };
    },
  });
}

export function openPaywall() {
  window.dispatchEvent(new Event(PAYWALL_EVENT));
}
export function onPaywall(fn: () => void) {
  window.addEventListener(PAYWALL_EVENT, fn);
  return () => window.removeEventListener(PAYWALL_EVENT, fn);
}
