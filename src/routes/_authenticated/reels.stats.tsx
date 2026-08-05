import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Heart, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteReel, fetchMyReels, type Reel } from "@/lib/reels-service";
import { formatRelativeDate, formatSeconds } from "@/lib/reels";

export const Route = createFileRoute("/_authenticated/reels/stats")({
  head: () => ({
    meta: [
      { title: "My Reels stats — Views, likes and comments | Bible Connect" },
      {
        name: "description",
        content:
          "See how your gospel reels are performing: views, likes, comments and your best-performing video.",
      },
      { property: "og:title", content: "My Reels stats — Bible Connect" },
      { property: "og:description", content: "Track performance of the reels you posted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReelsStats,
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Something went wrong loading your stats.
    </div>
  ),
});

function ReelsStats() {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: userId } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-reels", userId],
    queryFn: () => fetchMyReels(userId!),
    enabled: !!userId,
  });

  const remove = useMutation({
    mutationFn: (reel: Reel) => deleteReel(reel),
    onMutate: (reel) => setPendingId(reel.id),
    onSuccess: async () => {
      toast.success("Reel deleted");
      await queryClient.invalidateQueries({ queryKey: ["my-reels", userId] });
      await queryClient.invalidateQueries({ queryKey: ["reels-feed"] });
    },
    onError: () => toast.error("We couldn't delete that reel."),
    onSettled: () => setPendingId(null),
  });

  const reels = data ?? [];
  const totals = reels.reduce(
    (acc, r) => ({
      views: acc.views + r.view_count,
      likes: acc.likes + r.like_count,
      comments: acc.comments + r.comment_count,
    }),
    { views: 0, likes: 0, comments: 0 },
  );
  const best = reels.reduce<Reel | null>(
    (b, r) => (!b || r.like_count + r.view_count > b.like_count + b.view_count ? r : b),
    null,
  );

  return (
    <div className="pb-10">
      <PageHeader title="My Reels" subtitle="Your posts and how they're doing." />

      <div className="space-y-4 px-5">
        {isLoading && <Skeleton className="h-28 w-full rounded-2xl" />}

        {error && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">We couldn&apos;t load your stats.</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="grid grid-cols-4 gap-2">
              <StatTile label="Reels" value={reels.length} />
              <StatTile label="Views" value={totals.views} />
              <StatTile label="Likes" value={totals.likes} />
              <StatTile label="Comments" value={totals.comments} />
            </div>

            {best && (
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Best performing
                </p>
                <p className="mt-1 truncate text-sm font-medium">
                  {best.caption || "Untitled reel"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {best.view_count} views · {best.like_count} likes
                </p>
              </Card>
            )}

            {!reels.length && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-muted-foreground">You haven&apos;t posted any reels.</p>
                <Button asChild>
                  <Link to="/reels/upload">Upload your first reel</Link>
                </Button>
              </div>
            )}

            {reels.map((reel) => (
              <Card key={reel.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/reels/$reelId"
                    params={{ reelId: reel.id }}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {reel.caption || "Untitled reel"}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatRelativeDate(reel.created_at)} · {formatSeconds(reel.duration_seconds)}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> {reel.view_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" /> {reel.like_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> {reel.comment_count}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete reel"
                  disabled={pendingId === reel.id}
                  onClick={() => remove.mutate(reel)}
                >
                  {pendingId === reel.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
