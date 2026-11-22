import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { LEGAL_UPDATED } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <div className="grain min-h-screen bg-background text-foreground">
    <AppHeader />
    <main className="mx-auto max-w-3xl px-6 pb-20 pt-12">
      <Link to="/" className="text-sm text-primary hover:underline">CineFlow AI</Link>
      <h1 className="mt-4 font-display text-5xl">{title}</h1>
      <p className="mt-3 text-xs text-muted-foreground">Last updated {LEGAL_UPDATED} · NexoneLabs</p>
      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-foreground [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_ul]:list-disc">{children}</div>
    </main>
  </div>;
}