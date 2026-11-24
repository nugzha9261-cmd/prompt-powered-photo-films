import { Link } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { CreditsBadge } from "@/components/credits/credits-badge";
import cineflowIcon from "@/assets/cineflow-icon.png.asset.json";

const LINKS = [
  { to: "/studio", label: "Studio" },
  { to: "/images", label: "Image Lab" },
  { to: "/edit", label: "Edit" },
  { to: "/movie", label: "Mini-movie" },
  { to: "/director", label: "AI Director" },
  { to: "/library", label: "My films" },
] as const;

export function AppHeader() {
  const { session, ready, signOut } = useAuth();

  return (
    <header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-3 sm:flex sm:justify-between sm:gap-4 sm:px-6 sm:pt-8">
      <Link to="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3" aria-label="CineFlow AI home">
        <img src={cineflowIcon.url} alt="" width={48} height={48} className="size-9 shrink-0 rounded-md object-contain sm:size-12" />
        <span className="truncate font-display text-xl tracking-wide sm:text-2xl">CineFlow AI</span>
      </Link>
      <nav className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm">
        {ready && session ? (
          <>
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to}
                className="hidden rounded-sm px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground sm:inline lg:px-3"
                activeProps={{ className: "text-foreground" }}>
                {l.label}
              </Link>
            ))}
            <CreditsBadge />
            <Button asChild variant="ghost" size="icon-sm" title="Account" aria-label="Account">
              <Link to="/account"><UserRound /></Link>
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => void signOut()}
              title={session.user.email ?? undefined} aria-label="Sign out">
              <LogOut />
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
