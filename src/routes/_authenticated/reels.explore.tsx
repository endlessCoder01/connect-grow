import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReelCard } from "@/components/reels/ReelCard";
import { fetchMyLikes, fetchReelsPage, REELS_PAGE_SIZE } from "@/lib/reels-service";

export const Route = createFileRoute("/_authenticated/reels/explore")({
  head: () => ({
    meta: [
      { title: "Reels — Watch gospel videos | Bible Connect" },
      {
        name: "description",
        content:
          "Watch short gospel videos shared by the Bible Connect community. Like, comment and share encouragement.",
      },
      { property: "og:title", content: "Reels — Bible Connect" },
      {
        property: "og:description",
        content: "Short gospel videos from your church community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReelsExplore,
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Something went wrong loading the feed.
    </div>
  ),
});

function ReelsExplore() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const { data: userId } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["reels-feed"],
      queryFn: ({ pageParam }) => fetchReelsPage(pageParam),
      initialPageParam: 0,
      getNextPageParam: (last, all) => (last.length < REELS_PAGE_SIZE ? undefined : all.length),
    });

  const reels = useMemo(() => data?.pages.flat() ?? [], [data]);

  useEffect(() => {
    if (!userId || !reels.length) return;
    fetchMyLikes(
      reels.map((r) => r.id),
      userId,
    )
      .then(setLikedIds)
      .catch(() => undefined);
  }, [userId, reels]);

  useEffect(() => {
    if (!activeId && reels.length) setActiveId(reels[0]!.id);
  }, [reels, activeId]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const registerItem = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (!observerRef.current) return;
    observerRef.current.observe(node);
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const id = (entry.target as HTMLElement).dataset.reelId;
            if (id) setActiveId(id);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    observerRef.current = observer;
    root.querySelectorAll<HTMLElement>("[data-reel-id]").forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [reels.length]);

  // Load the next page once the last reel becomes active.
  useEffect(() => {
    if (!activeId || !hasNextPage || isFetchingNextPage) return;
    const idx = reels.findIndex((r) => r.id === activeId);
    if (idx >= 0 && idx >= reels.length - 2) void fetchNextPage();
  }, [activeId, reels, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setLiked = (reelId: string, liked: boolean) =>
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) next.add(reelId);
      else next.delete(reelId);
      return next;
    });

  if (isLoading) {
    return (
      <div className="p-5">
        <Skeleton className="h-[60dvh] w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">We couldn&apos;t load the reels feed.</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!reels.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <Film className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No reels yet — share the first one.</p>
        <Button asChild>
          <Link to="/reels/upload">Upload a reel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[calc(100dvh-11rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-none"
    >
      {reels.map((reel) => (
        <div
          key={reel.id}
          data-reel-id={reel.id}
          ref={registerItem}
          className="h-full w-full snap-start snap-always"
        >
          <ReelCard
            reel={reel}
            active={activeId === reel.id}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            currentUserId={userId ?? null}
            liked={likedIds.has(reel.id)}
            onLikedChange={setLiked}
          />
        </div>
      ))}
      {isFetchingNextPage && (
        <div className="py-4 text-center text-xs text-muted-foreground">Loading more…</div>
      )}
    </div>
  );
}
