import { Link } from "@tanstack/react-router";
import { Bot, Clapperboard, Film, Scissors, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const TABS = [
  { to: "/studio", label: "Studio", icon: Clapperboard },
  { to: "/images", label: "Images", icon: Sparkles },
  { to: "/edit", label: "Edit", icon: Scissors },
  { to: "/director", label: "Director", icon: Bot },
  { to: "/library", label: "My films", icon: Film },
] as const;

/** Phone-style bottom tabs; replaces the top link row below the sm breakpoint. */
export function MobileTabBar() {
  const { session, ready } = useAuth();
  if (!ready || !session) return null;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <div className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex min-w-0 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary" }}>
            <Icon className="size-5" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
