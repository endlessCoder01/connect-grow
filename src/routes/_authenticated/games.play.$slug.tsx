import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GamePlayer } from "@/components/games/GamePlayer";
import { PLAYABLE_SLUGS } from "@/lib/games";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/play/$slug")({
  beforeLoad: ({ params }) => {
    if (!(PLAYABLE_SLUGS as string[]).includes(params.slug)) throw notFound();
  },
  component: PlayPage,
  notFoundComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      That game is not available yet.
    </div>
  ),
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Something went wrong loading this game.
    </div>
  ),
});

function PlayPage() {
  const { slug } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["game", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, slug, name, description, icon")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/games" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Games
        </Link>
      </div>
      <PageHeader title={data?.name ?? "Loading…"} />
      {isLoading && (
        <div className="px-5">
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      )}
      {(error || (!isLoading && !data)) && (
        <div className="px-5 text-sm text-muted-foreground">
          We couldn&apos;t load this game.{" "}
          <Button asChild variant="link" className="px-1">
            <Link to="/games">Back to games</Link>
          </Button>
        </div>
      )}
      {data && (
        <GamePlayer
          slug={data.slug}
          name={data.name}
          description={data.description}
          icon={data.icon}
        />
      )}
    </div>
  );
}
