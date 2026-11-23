import { Link } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { CreditsBadge } from "@/components/credits/credits-badge";
import cineflowIcon from "@/assets/cineflow-icon.png.asset.json";

export function AppHeader() {
  const { session, ready, signOut } = useAuth();

  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-8">
      <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="CineFlow AI home">
        <img src={cineflowIcon.url} alt="" width={48} height={48} className="size-12 shrink-0 rounded-md object-contain" />
        <span className="font-display text-2xl tracking-wide">CineFlow AI</span>
      </Link>
      <nav className="flex w-full min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain whitespace-nowrap text-sm [scrollbar-width:none] sm:w-auto sm:gap-1">
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
              to="/movie"
              className="rounded-sm px-2 py-1.5 text-muted-foreground sm:px-3 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Mini-movie
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
            <CreditsBadge />
            <Button asChild variant="ghost" size="icon-sm" title="Account" aria-label="Account">
              <Link to="/account"><UserRound /></Link>
            </Button>
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
