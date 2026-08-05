import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Heart, HeartHandshake, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const prayersQuery = queryOptions({
  queryKey: ["prayer-requests"],
  queryFn: async () => {
    const [{ data, error }, { data: userData }] = await Promise.all([
      supabase
        .from("prayer_requests")
        .select("id, title, body, prayer_count, is_answered, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.auth.getUser(),
    ]);
    if (error) throw error;
    const me = userData.user?.id;
    const ids = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string | null }[] };
    const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name]));

    let myPrayers = new Set<string>();
    if (me && data?.length) {
      const { data: mine } = await supabase
        .from("prayers")
        .select("prayer_request_id")
        .eq("user_id", me)
        .in("prayer_request_id", data.map((r) => r.id));
      myPrayers = new Set((mine ?? []).map((r) => r.prayer_request_id));
    }
    return (data ?? []).map((r) => ({
      ...r,
      author: map[r.user_id] ?? "A friend",
      hasPrayed: myPrayers.has(r.id),
    }));
  },
});

export const Route = createFileRoute("/_authenticated/prayer/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(prayersQuery),
  component: PrayerPage,
});

function PrayerPage() {
  return (
    <div>
      <PageHeader
        title="Prayer wall"
        subtitle="Lift each other up."
        right={
          <Button asChild size="sm" className="gap-1">
            <Link to="/prayer/new">
              <Plus className="h-4 w-4" /> Ask
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
  const { data } = useSuspenseQuery(prayersQuery);
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function pray(id: string, hasPrayed: boolean) {
    setBusyId(id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in");
      if (hasPrayed) {
        await supabase
          .from("prayers")
          .delete()
          .eq("prayer_request_id", id)
          .eq("user_id", userData.user.id);
      } else {
        await supabase.from("prayers").insert({ prayer_request_id: id, user_id: userData.user.id });
        toast.success("Praying with you 🙏");
      }
      qc.invalidateQueries({ queryKey: ["prayer-requests"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Try again");
    } finally {
      setBusyId(null);
    }
  }

  if (data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Heart className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-semibold">No prayer requests yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Share what's on your heart.</p>
        <Button asChild className="mt-4">
          <Link to="/prayer/new">Post a request</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((r) => (
        <Card key={r.id} className="p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {r.author} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
            </span>
            {r.is_answered && (
              <span className="inline-flex items-center gap-1 text-gold">
                <CheckCircle2 className="h-3 w-3" /> Answered
              </span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-semibold">{r.title}</h3>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {r.body}
          </p>
          <Button
            variant={r.hasPrayed ? "secondary" : "default"}
            onClick={() => pray(r.id, r.hasPrayed)}
            disabled={busyId === r.id}
            className="mt-4 h-10 w-full gap-2"
          >
            <HeartHandshake className="h-4 w-4" />
            {r.hasPrayed ? `Praying (${r.prayer_count})` : `I'll pray (${r.prayer_count})`}
          </Button>
        </Card>
      ))}
    </div>
  );
}
