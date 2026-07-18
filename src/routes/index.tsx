import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container-mobile px-6 pt-16 pb-24">
        <div className="mb-14 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Bible Connect</span>
        </div>

        <div className="mb-12">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> Connect · Grow · Worship
          </p>
          <h1 className="text-5xl leading-[1.05] tracking-tight text-foreground">
            Scripture,{" "}
            <span className="italic text-primary">community,</span> and prayer — in one place.
          </h1>
          <p className="mt-5 scripture text-lg text-muted-foreground">
            "Freely you have received; freely give."
            <span className="ml-2 not-italic text-sm">— Matthew 10:8</span>
          </p>
        </div>

        <div className="mb-14 space-y-3">
          <Button asChild size="lg" className="h-14 w-full text-base">
            <Link to="/auth" search={{ mode: "signup" }}>
              Create your account
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-14 w-full text-base">
            <Link to="/auth" search={{ mode: "signin" }}>
              I already have an account
            </Link>
          </Button>
        </div>

        <div className="space-y-4">
          <FeatureRow icon={BookOpen} title="Read the Word" body="KJV Scripture, chapter by chapter." />
          <FeatureRow icon={Users} title="Your church, together" body="Create or join a church community." />
          <FeatureRow icon={Heart} title="Prayer & testimony" body="Lift each other up in real time." />
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof BookOpen;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-semibold text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
