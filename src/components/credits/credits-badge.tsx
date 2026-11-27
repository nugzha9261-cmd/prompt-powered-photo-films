import { useEffect, useState } from "react";
import { Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { onPaywall, useCredits } from "@/hooks/use-credits";
import { AppleSubscriptions } from "./apple-subscriptions";
import { supportsApplePurchases } from "@/lib/revenuecat";
import { useSubscription } from "@/hooks/use-subscription";

export function CreditsBadge() {
  const { data } = useCredits();
  const balance = data?.balance;
  const [open, setOpen] = useState(false);
  const [apple, setApple] = useState(false);
  const subscription = useSubscription();
  useEffect(() => { setApple(supportsApplePurchases()); }, []);
  useEffect(() => onPaywall(() => setOpen(true)), []);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-auto gap-1.5 rounded-full border border-primary/40 px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
        aria-label="Your credits"
      >
        <Film className="size-3.5" />
        {balance ?? "–"} <span className="hidden sm:inline">{balance === 1 ? "credit" : "credits"}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Your credits</DialogTitle>
            <DialogDescription>
              You have {balance ?? 0} {balance === 1 ? "credit" : "credits"}. 5-second videos cost 2 credits; 10-second videos cost 4. One image costs 1 credit. Edits cost 1 credit per section (up to 10 seconds).
            </DialogDescription>
          </DialogHeader>
          {apple ? <AppleSubscriptions /> : subscription.data?.premium ? <p className="text-sm text-primary">CineFlow Premium active · clean exports</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
