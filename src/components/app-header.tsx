import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader() {
  const { session, ready, signOut } = useAuth();

  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pt-8">
      <Link to="/" className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-safelight shadow-[0_0_14px_var(--safelight)]" />
        <span className="font-display text-2xl tracking-wide">Lumière</span>
      </Link>
      <nav className="-mx-2 flex max-w-full items-center gap-0.5 overflow-x-auto whitespace-nowrap text-sm sm:mx-0 sm:gap-1">
        {ready && session ? (
          <>
            <Link
              to="/studio"
              className="rounded-sm px-2 py-1.5 text-muted-foreground sm:px-3 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Studio
            </Link>
            <Link
              to="/edit"
              className="rounded-sm px-2 py-1.5 text-muted-foreground sm:px-3 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Edit video
            </Link>
            <Link
              to="/director"
              className="rounded-sm px-2 py-1.5 text-muted-foreground sm:px-3 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              AI Director
            </Link>
            <Link
              to="/library"
              className="rounded-sm px-2 py-1.5 text-muted-foreground sm:px-3 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              My films
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
              title={session.user.email ?? undefined}
              aria-label="Sign out"
            >
              <LogOut /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </>
        ) : ready ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        ) : null}
      </nav>
    </header>
  );
}

export function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="mb-2.5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
      <span className="font-display text-base normal-case tracking-normal text-primary">{n}</span>
      {children}
    </p>
  );
}
