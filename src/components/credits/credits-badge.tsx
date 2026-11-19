import { useEffect, useState } from "react";
import { Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUBSCRIPTION_PLANS } from "@/lib/credits";
import { isNativeApp } from "@/lib/native";
import { onPaywall, useCredits } from "@/hooks/use-credits";

export function CreditsBadge() {
  const { data: balance } = useCredits();
  const [open, setOpen] = useState(false);
  useEffect(() => onPaywall(() => setOpen(true)), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-primary/40 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
        aria-label="Your credits"
      >
        <Film className="size-3.5" />
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
              : "Purchases will open in the Lumière app for iPhone and Android soon."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
