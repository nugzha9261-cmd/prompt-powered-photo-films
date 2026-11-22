import { Link } from "@tanstack/react-router";

export function AppFooter() {
  return <footer className="border-t border-border bg-background px-6 py-6 text-xs text-muted-foreground">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
      <span>CineFlow AI · NexoneLabs</span>
      <nav aria-label="Legal and support" className="flex flex-wrap gap-5">
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
        <Link to="/support" className="hover:text-foreground">Support</Link>
      </nav>
    </div>
  </footer>;
}