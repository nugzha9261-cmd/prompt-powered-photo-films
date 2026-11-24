import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { deleteAccount } from "@/lib/account.functions";
import { clearDirectorThreads } from "@/lib/director-threads";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => legalHead("Account", "Manage your CineFlow AI account, recover your password or permanently delete your account and films."),
  component: AccountPage,
});
function AccountPage() {
  const { session, signOut } = useAuth();
  const erase = useServerFn(deleteAccount);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (confirmation !== "DELETE" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await erase({ data: { confirmation: "DELETE" } });
      if (!result.ok) { setError(result.error); return; }
      clearDirectorThreads();
      sessionStorage.removeItem("lumiere:after-auth");
      toast.success("Your account and saved films have been deleted.");
      await signOut();
    } catch {
      setError("We couldn't finish deleting your account. Please try again.");
    } finally { setBusy(false); }
  };
  return <div className="grain min-h-screen bg-background text-foreground">
    <AppHeader />
    <main className="mx-auto max-w-2xl px-6 pb-20 pt-12">
      <h1 className="font-display text-5xl">Account</h1>
      <section className="mt-10 border-b border-border pb-8">
        <h2 className="font-display text-2xl">Your sign-in</h2>
        <p className="mt-3 break-all text-sm text-muted-foreground">{session?.user.email}</p>
        <p className="mt-4 text-sm text-muted-foreground">To reset your password, sign out and choose Forgot password? on the sign-in page.</p>
        <Button className="mt-4" variant="outline" onClick={() => void signOut()}><KeyRound />Sign out</Button>
      </section>
      <section className="border-b border-border py-8">
        <h2 className="font-display text-2xl">Privacy and help</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline"><Link to="/privacy">Privacy policy</Link></Button>
          <Button asChild variant="outline"><Link to="/terms">Terms of service</Link></Button>
          <Button asChild variant="outline"><Link to="/support">Support</Link></Button>
        </div>
      </section>
      <section className="py-8">
        <h2 className="font-display text-2xl">Delete account</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Permanently remove your account, saved films, preview images and unused credits. This cannot be undone. Download any films you want to keep first. Deleting your account does not cancel your Apple subscription; cancel it in your Apple account settings first.</p>
        <Button asChild variant="link" className="mt-2 px-0"><a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">Manage Apple subscriptions</a></Button>
        <Button className="mt-5" variant="destructive" onClick={() => setOpen(true)}><Trash2 />Delete account</Button>
      </section>
    </main>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) { setOpen(next); setConfirmation(""); setError(null); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Delete your account permanently?</DialogTitle><DialogDescription>Your saved films, previews, credits and sign-in account will be removed. All AI Director chats saved in this browser will also be cleared. Other devices and downloaded files are not erased. An Apple subscription must be canceled separately with Apple.</DialogDescription></DialogHeader>
        <div className="space-y-2"><Label htmlFor="delete-confirmation">Type DELETE to confirm</Label><Input id="delete-confirmation" autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep account</Button>
          <Button variant="destructive" disabled={confirmation !== "DELETE" || busy} onClick={() => void remove()}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}{busy ? "Deleting…" : "Permanently delete"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}