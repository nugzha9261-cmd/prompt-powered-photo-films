import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, GalleryHorizontal, ImageIcon, Sparkles, Users } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumière — Turn your photos into AI videos" },
      {
        name: "description",
        content:
          "Upload one or more photos, describe the motion, and Lumière makes a short AI video with sound — saved to your account.",
      },
      { property: "og:title", content: "Lumière — Turn your photos into AI videos" },
      {
        property: "og:description",
        content: "Animate a photo, morph from a first to a last scene, or build a storyboard. Every video is saved.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const MODES = [
  { icon: ImageIcon, title: "One photo", body: "Bring a single still to life with motion and sound." },
  { icon: ArrowRight, title: "First → last scene", body: "Start on one photo and glide to end on another." },
  { icon: GalleryHorizontal, title: "Storyboard", body: "First scene, middle scenes, last scene — one flowing video." },
  { icon: Users, title: "Reference photos", body: "Put the people or things in your photos into a brand-new scene." },
];

function Landing() {
  const { session, ready } = useAuth();
  const signedIn = ready && !!session;

  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <section className="max-w-3xl">
          <h1 className="font-display text-6xl leading-[1.0] sm:text-7xl lg:text-8xl">
            Every photo
            <br />
            <em className="text-primary">wants to move.</em>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Drop in your stills, describe what should happen, and we&apos;ll develop them into a
            short video — sound included. Everything you make is saved to your account.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-base font-semibold">
              <Link to={signedIn ? "/studio" : "/auth"}>
                <Sparkles /> {signedIn ? "Open the studio" : "Start creating — it's free to sign up"}
              </Link>
            </Button>
            {signedIn && (
              <Button asChild size="lg" variant="ghost" className="h-12">
                <Link to="/library">My films</Link>
              </Button>
            )}
          </div>
        </section>

        <section className="mt-20 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="bg-card p-6">
              <span className="font-display text-sm text-primary">0{i + 1}</span>
              <Icon className="mt-4 size-5 text-primary" />
              <h2 className="mt-3 font-display text-2xl">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
