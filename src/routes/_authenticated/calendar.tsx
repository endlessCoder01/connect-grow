import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CalendarDays, MapPin, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

const eventsQuery = queryOptions({
  queryKey: ["calendar-events"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id, title, description, location, starts_at, ends_at, church_id")
      .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/calendar")({
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQuery),
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
      </div>
      <PageHeader
        title="Calendar"
        subtitle="Gatherings and church events."
        right={
          <Button asChild size="sm" className="gap-1">
            <Link to="/calendar/new"><Plus className="h-4 w-4" /> Event</Link>
          </Button>
        }
      />
      <div className="px-5">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <EventList />
        </Suspense>
      </div>
    </div>
  );
}

function EventList() {
  const { data } = useSuspenseQuery(eventsQuery);
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CalendarDays className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-semibold">Nothing scheduled</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add a gathering or worship night.</p>
        <Button asChild className="mt-4"><Link to="/calendar/new">Create event</Link></Button>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((e) => {
        const start = new Date(e.starts_at);
        return (
          <Card key={e.id} className="flex gap-4 p-4">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <div className="text-xs uppercase tracking-wider">{format(start, "MMM")}</div>
              <div className="text-lg font-bold leading-none">{format(start, "d")}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{e.title}</div>
              <div className="text-xs text-muted-foreground">{format(start, "EEE, MMM d · p")}</div>
              {e.location && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {e.location}
                </div>
              )}
              {e.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
