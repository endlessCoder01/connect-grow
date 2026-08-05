import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MapPin, Users } from "lucide-react";

const churchesQuery = queryOptions({
  queryKey: ["churches"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("churches")
      .select("id, slug, name, description, logo_url, city, country")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/community/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(churchesQuery),
  component: CommunityPage,
});

function CommunityPage() {
  return (
    <div>
      <PageHeader
        title="Communities"
        subtitle="Find your church home."
        right={
          <Button asChild size="sm" className="gap-1">
            <Link to="/community/new">
              <Plus className="h-4 w-4" /> New
            </Link>
          </Button>
        }
      />
      <div className="px-5">
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-2xl" />}>
          <ChurchList />
        </Suspense>
      </div>
    </div>
  );
}

function ChurchList() {
  const { data } = useSuspenseQuery(churchesQuery);
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="font-semibold">No communities yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Be the first to create your church community.
        </p>
        <Button asChild className="mt-4">
          <Link to="/community/new">Create a community</Link>
        </Button>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((c) => (
        <Link key={c.id} to="/community/$slug" params={{ slug: c.slug }}>
          <Card className="flex items-start gap-4 p-4 transition hover:border-primary/40 hover:shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
              {c.logo_url ? (
                <img src={c.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Users className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{c.name}</div>
              {c.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              )}
              {(c.city || c.country) && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {[c.city, c.country].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
