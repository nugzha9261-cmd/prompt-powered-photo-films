import { useEffect, useState } from "react";
import { Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUBSCRIPTION_PLANS } from "@/lib/credits";
import { isNativeApp } from "@/lib/native";
import { creditsKey, onPaywall, useCredits } from "@/hooks/use-credits";
import { supabase } from "@/integrations/supabase/client";
import { dailyClaimWait } from "@/lib/credits";
import { useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";

export function CreditsBadge() {
  const { data } = useCredits();
  const balance = data?.balance;
  const wait = dailyClaimWait(data?.lastClaim);
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [open, setOpen] = useState(false);
  const claim = async () => {
    setClaiming(true);
    const { data: next, error } = await supabase.rpc("claim_daily_credit");
    setClaiming(false);
    if (error) {
      toast.error("Couldn't claim your free video. Try again.");
      return;
    }
    if (next == null) toast.info("Already claimed — come back tomorrow.");
    else toast.success("1 free video added!");
    void queryClient.invalidateQueries({ queryKey: creditsKey });
  };
  useEffect(() => onPaywall(() => setOpen(true)), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-primary/40 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
        aria-label="Your credits"
      >
        {data && wait === 0 ? <Gift className="size-3.5 animate-pulse" /> : <Film className="size-3.5" />}
        {balance ?? "–"} <span className="hidden sm:inline">{balance === 1 ? "credit" : "credits"}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Choose a plan</DialogTitle>
            <DialogDescription>
              You have {balance ?? 0} {balance === 1 ? "credit" : "credits"}. One credit makes one video or one edited section (up to 10 seconds).
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 p-4">
            <div>
              <p className="flex items-center gap-2 font-medium"><Gift className="size-4 text-primary" /> Daily free video</p>
              <p className="text-sm text-muted-foreground">
                {wait > 0 ? `Next one in ${Math.ceil(wait / 3600_000)}h` : "Claim 1 free video every day."}
              </p>
            </div>
            <Button variant="outline" disabled={wait > 0 || claiming || data == null} onClick={() => void claim()}>
              {wait > 0 ? "Claimed" : "Claim"}
            </Button>
          </div>
          <div className="grid gap-3">
            {SUBSCRIPTION_PLANS.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-4">
                <div>
                  <p className="font-medium">
                    {p.label}
                    {p.badge && (
                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{p.badge}</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {p.credits} videos per {p.period} · renews automatically
                  </p>
                </div>
                <Button disabled>{p.price}/{p.period === "3 months" ? "3 mo" : p.period}</Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {isNativeApp()
              ? "In-app purchases are coming soon."
              : "Purchases will open in the CineFlow AI app for iPhone and Android soon."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
