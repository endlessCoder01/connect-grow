import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Video, ChevronLeft, ExternalLink } from "lucide-react";
import { format, isPast } from "date-fns";

const meetingsQuery = queryOptions({
  queryKey: ["meetings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("meetings")
      .select("id, title, description, provider, meeting_url, starts_at, ends_at, host_id, church_id")
      .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/meetings/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meetingsQuery),
  component: MeetingsPage,
});

const providerLabel: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  other: "Online",
};

function MeetingsPage() {
  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
      </div>
      <PageHeader
        title="Meetings"
        subtitle="Bible studies, prayer calls, worship nights."
        right={
          <Button asChild size="sm" className="gap-1">
            <Link to="/meetings/new"><Plus className="h-4 w-4" /> Meeting</Link>
          </Button>
        }
      />
      <div className="px-5">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <MeetingList />
        </Suspense>
      </div>
    </div>
  );
}

function MeetingList() {
  const { data } = useSuspenseQuery(meetingsQuery);
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Video className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-semibold">No meetings scheduled</h3>
        <p className="mt-1 text-sm text-muted-foreground">Host a Zoom or Google Meet gathering.</p>
        <Button asChild className="mt-4"><Link to="/meetings/new">Schedule</Link></Button>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((m) => {
        const start = new Date(m.starts_at);
        const live = !isPast(start) === false && (!m.ends_at || !isPast(new Date(m.ends_at)));
        return (
          <Card key={m.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {providerLabel[m.provider] ?? "Online"}
                  </span>
                  {live && <span className="text-red-600">● Live</span>}
                </div>
                <div className="mt-1 font-semibold">{m.title}</div>
                <div className="text-xs text-muted-foreground">
                  {format(start, "EEE, MMM d · p")}
                </div>
                {m.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                )}
              </div>
              <Button asChild size="sm" className="gap-1">
                <a href={m.meeting_url} target="_blank" rel="noopener noreferrer">
                  Join <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
