import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./use-auth";
import { getSubscriptionStatus } from "@/lib/subscriptions.functions";

export const subscriptionKey = ["subscription"] as const;
export function useSubscription() {
  const { session } = useAuth();
  const read = useServerFn(getSubscriptionStatus);
  return useQuery({
    queryKey: [...subscriptionKey, session?.user.id],
    enabled: Boolean(session),
    queryFn: () => read(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}