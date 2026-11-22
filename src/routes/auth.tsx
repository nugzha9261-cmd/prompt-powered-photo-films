import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rememberAfterAuth, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { isNativeApp } from "@/lib/native";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CineFlow AI" },
      { name: "description", content: "Sign in to CineFlow AI to make photo videos and keep them all in your account." },
      { property: "og:title", content: "Sign in — CineFlow AI" },
      { property: "og:description", content: "Your AI photo videos, saved to your own account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type View = "signin" | "signup" | "forgot" | "check-email" | "reset-sent";

function AuthPage() {
  const navigate = useNavigate();
  const { session, ready } = useAuth();
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Google blocks sign-in inside app web views, so the phone apps use email only.
  const [nativeApp, setNativeApp] = useState(false);
  useEffect(() => setNativeApp(isNativeApp()), []);

  useEffect(() => {
    if (ready && session) void navigate({ to: "/studio", replace: true });
  }, [ready, session, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (view === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigate({ to: "/studio" });
      } else if (view === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) await navigate({ to: "/studio" });
        else {
          rememberAfterAuth("/studio");
          setView("check-email");
        }
      } else if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setView("reset-sent");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    rememberAfterAuth("/studio");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed.");
      return;
    }
    if (result.redirected) return;
    await navigate({ to: "/studio" });
  };

  const title =
    view === "signup" ? "Create your account" : view === "forgot" ? "Reset your password" : "Welcome back";

  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col px-6 pb-20 pt-16">
        {view === "check-email" || view === "reset-sent" ? (
          <div className="rounded-md border border-border bg-card p-8 text-center">
            <MailCheck className="mx-auto size-8 text-primary" />
            <h1 className="mt-4 font-display text-4xl">Check your email</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {view === "check-email"
                ? `We sent a confirmation link to ${email}. Open it to finish creating your account.`
                : `If an account exists for ${email}, a link to set a new password is on its way.`}
            </p>
            <Button variant="link" className="mt-4" onClick={() => setView("signin")}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-5xl leading-tight">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Every video you make is saved to your account, so you can watch or download it any time.
            </p>

            {false && view !== "forgot" && !nativeApp && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="mt-8 h-11 w-full"
                  onClick={() => void google()}
                >
                  <GoogleMark /> Continue with Google
                </Button>
                <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-card"
                />
              </div>
              {view !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {view === "signin" && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setView("forgot")}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={view === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-card"
                  />
                </div>
              )}
              <Button type="submit" size="lg" className="h-11 w-full font-semibold" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                {view === "signup" ? "Create account" : view === "forgot" ? "Send reset link" : "Sign in"}
              </Button>
            </form>

            {view === "signup" && <p className="mt-4 text-xs leading-5 text-muted-foreground">By creating an account, you agree to our <Link to="/terms" className="text-primary underline">Terms of service</Link> and acknowledge our <Link to="/privacy" className="text-primary underline">Privacy policy</Link>.</p>}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {view === "signin" ? (
                <>
                  New here?{" "}
                  <button className="text-primary hover:underline" onClick={() => setView("signup")}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button className="text-primary hover:underline" onClick={() => setView("signin")}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.68 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.96S8.78 6.56 12 6.56c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.69 4.03 14.56 3 12 3 6.98 3 2.9 7.03 2.9 12.02S6.98 21.04 12 21.04c6.93 0 9.5-4.86 9.5-7.36 0-.5-.05-.88-.15-1.26z" />
    </svg>
  );
}
