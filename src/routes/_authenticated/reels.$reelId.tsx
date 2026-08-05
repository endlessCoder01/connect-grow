import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReelCard } from "@/components/reels/ReelCard";
import { fetchMyLikes, fetchReelById } from "@/lib/reels-service";

export const Route = createFileRoute("/_authenticated/reels/$reelId")({
  head: () => ({
    meta: [
      { title: "Watch a Reel — Gospel video | Bible Connect" },
      {
        name: "description",
        content: "Watch a short gospel video shared on Bible Connect and encourage the community.",
      },
      { property: "og:title", content: "Watch a Reel — Bible Connect" },
      { property: "og:description", content: "A short gospel video from Bible Connect." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReelDetail,
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Something went wrong loading this reel.
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">Reel not found.</div>
  ),
});

function ReelDetail() {
  const { reelId } = useParams({ from: "/_authenticated/reels/$reelId" });
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);

  const { data: userId } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reel", reelId],
    queryFn: () => fetchReelById(reelId),
  });

  useEffect(() => {
    if (!userId || !data) return;
    fetchMyLikes([data.id], userId)
      .then((set) => setLiked(set.has(data.id)))
      .catch(() => undefined);
  }, [userId, data]);

  if (isLoading) return <Skeleton className="m-5 h-[60dvh] rounded-2xl" />;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">We couldn&apos;t load this reel.</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">This reel is no longer available.</p>
        <Button asChild>
          <Link to="/reels/explore">Back to Explore</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-11rem)]">
      <ReelCard
        reel={data}
        active
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        currentUserId={userId ?? null}
        liked={liked}
        onLikedChange={(_, value) => setLiked(value)}
      />
    </div>
  );
}
