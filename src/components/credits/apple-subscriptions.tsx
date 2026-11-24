import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { Check, CreditCard, ExternalLink, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { creditsKey } from "@/hooks/use-credits";
import { subscriptionKey, useSubscription } from "@/hooks/use-subscription";
import { SUBSCRIPTION_PLANS } from "@/lib/credits";
import { getPaymentDelivery } from "@/lib/subscriptions.functions";
import { loadApplePackages, manageAppleSubscription, purchaseApplePackage, purchaseWasCancelled, restoreApplePurchases } from "@/lib/revenuecat";

const PERIODS: Record<string, string> = { P1W: "week", P1M: "month", P3M: "3 months" };

export function AppleSubscriptions() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const subscription = useSubscription();
  const queryClient = useQueryClient();
  const delivery = useServerFn(getPaymentDelivery);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const next = await loadApplePackages(userId);
      if (mounted.current) setPackages(next);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Subscriptions couldn't load.");
    } finally { if (mounted.current) setLoading(false); }
  };
  useEffect(() => { void load(); }, [userId]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: creditsKey }),
      queryClient.invalidateQueries({ queryKey: subscriptionKey }),
    ]);
  };

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const check = async () => {
      try {
        const result = await delivery({ data: { transactionId: pending } });
        if (!cancelled && result.delivered) {
          await refresh();
          if (!cancelled) { setPending(null); toast.success(`${result.credits} credits added to your account.`); }
        }
      } catch { /* Keep pending; don't invite a second charge when verification is delayed. */ }
    };
    void check();
    const timer = setInterval(() => void check(), 3_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [pending, delivery, queryClient]);

  const buy = async (pack: PurchasesPackage) => {
    if (!userId || busy || pending || !subscription.data?.checkoutReady) return;
    setBusy(pack.product.identifier); setError(null);
    try {
      const result = await purchaseApplePackage(userId, pack);
      if (!mounted.current) return;
      setPending(result.transaction.transactionIdentifier);
      await refresh();
    } catch (e) {
      if (!mounted.current || purchaseWasCancelled(e)) return;
      setError("Purchase couldn't finish. If Apple charged you, use Restore Purchases or contact Support before trying again.");
    } finally { if (mounted.current) setBusy(null); }
  };

  const restore = async () => {
    if (!userId || busy) return;
    setBusy("restore"); setError(null);
    try {
      await restoreApplePurchases(userId);
      await refresh();
      const verified = await subscription.refetch();
      toast.info(verified.data?.premium ? "Your subscription is restored. Restoring does not add credits again." : "Restore completed. No active subscription is confirmed for this CineFlow account yet.");
    } catch {
      if (mounted.current) setError("Couldn't restore purchases. Check your Apple account and try again.");
    } finally { if (mounted.current) setBusy(null); }
  };

  const manage = async () => {
    if (!userId || busy) return;
    setBusy("manage");
    try { await manageAppleSubscription(userId); }
    catch { setError("Couldn't open Apple subscriptions. You can manage them in your iPhone Settings."); }
    finally { if (mounted.current) setBusy(null); }
  };

  return <section className="space-y-4 border-t border-border pt-4" aria-label="Apple subscriptions">
    <h2 className="font-display text-xl">CineFlow Premium</h2>
    {subscription.data?.premium && <p className="flex items-center gap-2 text-sm text-primary"><Check className="size-4" />Premium active · clean exports</p>}
    {pending && <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground"><Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />Apple purchase completed. Your credits are awaiting confirmation; don’t purchase again.</p>}
    {subscription.isError && <p role="alert" className="text-sm text-destructive">Couldn't check your subscription. <Button variant="link" size="sm" onClick={() => void subscription.refetch()}>Retry</Button></p>}
    {!subscription.data?.checkoutReady && !subscription.isPending && !subscription.isError && <p className="text-sm text-muted-foreground">New subscriptions are currently unavailable.</p>}
    {subscription.data?.checkoutReady && !loading && !packages.length && <div className="space-y-2 opacity-70">
      {SUBSCRIPTION_PLANS.map((plan) => <div key={plan.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
        <div className="min-w-0"><p className="font-medium">{plan.label}</p><p className="text-xs text-muted-foreground">{plan.credits} credits / {plan.period} · {plan.price}</p></div>
        <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void load()}><RefreshCw />Retry</Button>
      </div>)}
    </div>}
    {subscription.data?.checkoutReady && (loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading Apple prices…</p> : <div className="space-y-2">
      {SUBSCRIPTION_PLANS.map((plan) => {
        const pack = packages.find((item) => item.product.identifier === plan.id);
        const period = pack?.product.subscriptionPeriod ? PERIODS[pack.product.subscriptionPeriod] : undefined;
        if (!pack || !period) return null;
        const active = subscription.data?.premium && subscription.data.productId === plan.id;
        return <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
          <div className="min-w-0"><p className="font-medium">{plan.label}{plan.badge && <span className="ml-2 text-xs text-primary">{plan.badge}</span>}</p><p className="text-xs text-muted-foreground">{plan.credits} credits / {period} · {pack.product.priceString} / {period}</p></div>
          <Button size="sm" disabled={Boolean(busy || pending || active)} onClick={() => void buy(pack)}>
            {busy === plan.id ? <Loader2 className="animate-spin" /> : active ? <Check /> : <CreditCard />}{active ? "Current plan" : "Subscribe"}
          </Button>
        </div>;
      })}
    </div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}{!packages.length && " Apple may still be preparing new plans — tap Retry in a moment."}</p>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void restore()}>{busy === "restore" ? <Loader2 className="animate-spin" /> : <RotateCcw />}Restore Purchases</Button>
      <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void manage()}><ExternalLink />Manage Subscription</Button>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">Payment is charged to your Apple account. Subscriptions renew automatically unless canceled at least 24 hours before the current period ends. Your account is charged for renewal within 24 hours before that period ends. Manage or cancel in Apple account settings. Credits are granted for each paid period, carry over, and remain after refunds. One credit covers one video generation or edited section up to 10 seconds; longer edits use multiple credits. Restoring does not grant credits again. Premium removes the export watermark while active.</p>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><Link className="underline" to="/privacy">Privacy policy</Link><Link className="underline" to="/terms">Terms of use</Link><Link className="underline" to="/support">Support</Link></div>
  </section>;
}