import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const testimoniesQuery = queryOptions({
  queryKey: ["testimonies"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("testimonies")
      .select("id, title, body, created_at, user_id")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const ids = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    if (!ids.length) return [];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name]));
    return (data ?? []).map((t) => ({ ...t, author: map[t.user_id] ?? "A friend" }));
  },
});

export const Route = createFileRoute("/_authenticated/testimonies")({
  loader: ({ context }) => context.queryClient.ensureQueryData(testimoniesQuery),
  component: TestimoniesPage,
});

function TestimoniesPage() {
  return (
    <div>
      <PageHeader
        title="Testimonies"
        subtitle="What has the Lord done for you?"
        right={
          <Button asChild size="sm" className="gap-1">
            <Link to="/testimonies/new">
              <Plus className="h-4 w-4" /> Share
            </Link>
          </Button>
        }
      />
      <div className="px-5">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <List />
        </Suspense>
      </div>
    </div>
  );
}

function List() {
  const { data } = useSuspenseQuery(testimoniesQuery);
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-gold" />
        <h3 className="font-semibold">Your story matters</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Be the first to share a testimony.
        </p>
        <Button asChild className="mt-4">
          <Link to="/testimonies/new">Share yours</Link>
        </Button>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((t) => (
        <Card key={t.id} className="p-5">
          <div className="text-xs text-muted-foreground">
            {t.author} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
          </div>
          <h3 className="mt-1 text-lg font-semibold">{t.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {t.body}
          </p>
        </Card>
      ))}
    </div>
  );
}
