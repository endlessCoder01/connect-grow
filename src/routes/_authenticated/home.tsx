import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { fetchPassage, referenceOfTheDay } from "@/lib/bible";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, Users, MessageSquare, CalendarDays } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const verseQuery = queryOptions({
  queryKey: ["verse-of-day"],
  queryFn: async () => {
    const ref = referenceOfTheDay();
    const passage = await fetchPassage(ref);
    return passage;
  },
  staleTime: 60 * 60 * 1000,
});

const feedQuery = queryOptions({
  queryKey: ["home-feed"],
  queryFn: async () => {
    const [{ data: testimonies }, { data: prayers }] = await Promise.all([
      supabase
        .from("testimonies")
        .select("id, title, body, created_at, user_id")
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("prayer_requests")
        .select("id, title, body, prayer_count, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    const userIds = Array.from(
      new Set([...(testimonies ?? []), ...(prayers ?? [])].map((r) => r.user_id)),
    );
    let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      profiles = Object.fromEntries(
        (profs ?? []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]),
      );
    }
    return {
      testimonies: (testimonies ?? []).map((t) => ({ ...t, profile: profiles[t.user_id] })),
      prayers: (prayers ?? []).map((p) => ({ ...p, profile: profiles[p.user_id] })),
    };
  },
});

export const Route = createFileRoute("/_authenticated/home")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(verseQuery);
    void context.queryClient.prefetchQuery(feedQuery);
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <PageHeader title="Today" subtitle="Peace be with you." />
      <Suspense fallback={<VerseSkeleton />}>
        <VerseOfDay />
      </Suspense>
      <div className="mt-6 grid grid-cols-2 gap-3 px-5">
        <Link to="/forum" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">Discussion</div>
            <div className="text-xs text-muted-foreground">Ask & encourage</div>
          </div>
        </Link>
        <Link to="/calendar" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">Calendar</div>
            <div className="text-xs text-muted-foreground">Upcoming events</div>
          </div>
        </Link>
      </div>
      <Suspense fallback={<div className="px-5"><Skeleton className="h-40 w-full" /></div>}>
        <Feed />
      </Suspense>
    </div>
  );
}

function VerseSkeleton() {
  return (
    <div className="px-5">
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

function VerseOfDay() {
  const { data } = useSuspenseQuery(verseQuery);
  return (
    <div className="px-5">
      <Card className="overflow-hidden border-none bg-primary p-6 text-primary-foreground shadow-lg">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
          <span className="h-1 w-1 rounded-full bg-gold" /> Verse of the day
        </div>
        <p className="scripture text-xl leading-relaxed">
          "{data.text.trim().replace(/\s+/g, " ")}"
        </p>
        <div className="mt-4 text-sm font-medium text-gold">{data.reference} · KJV</div>
      </Card>
    </div>
  );
}

function Feed() {
  const { data } = useSuspenseQuery(feedQuery);
  return (
    <div className="mt-8 space-y-8 px-5">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent testimonies</h2>
          <Link to="/testimonies" className="text-sm text-primary">See all</Link>
        </div>
        {data.testimonies.length === 0 ? (
          <EmptyRow icon={Heart} text="Be the first to share what God has done." />
        ) : (
          <div className="space-y-3">
            {data.testimonies.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="text-xs text-muted-foreground">
                  {t.profile?.display_name ?? "A friend"} ·{" "}
                  {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                </div>
                <div className="mt-1 font-semibold">{t.title}</div>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{t.body}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Prayer requests</h2>
          <Link to="/prayer" className="text-sm text-primary">See all</Link>
        </div>
        {data.prayers.length === 0 ? (
          <EmptyRow icon={MessageCircle} text="No prayer requests yet." />
        ) : (
          <div className="space-y-3">
            {data.prayers.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="text-xs text-muted-foreground">
                  {p.profile?.display_name ?? "A friend"}
                </div>
                <div className="mt-1 font-semibold">{p.title}</div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                  <Users className="h-3 w-3" /> {p.prayer_count} praying
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: typeof Heart; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" /> {text}
    </div>
  );
}
