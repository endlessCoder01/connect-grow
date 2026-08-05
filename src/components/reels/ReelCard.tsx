import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2, MessageCircle, Pause, Play, Share2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  likeReel,
  registerView,
  signedVideoUrl,
  unlikeReel,
  type Reel,
} from "@/lib/reels-service";
import { formatRelativeDate, initialsOf, reelShareUrl } from "@/lib/reels";
import { ReelComments } from "@/components/reels/ReelComments";

export function ReelCard({
  reel,
  active,
  muted,
  onToggleMute,
  currentUserId,
  liked,
  onLikedChange,
}: {
  reel: Reel;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  currentUserId: string | null;
  liked: boolean;
  onLikedChange: (reelId: string, liked: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const queryClient = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeCount, setLikeCount] = useState(reel.like_count);
  const viewedRef = useRef(false);

  useEffect(() => setLikeCount(reel.like_count), [reel.like_count]);

  // Lazily resolve a signed URL only when the reel is (or is about to be) on screen.
  useEffect(() => {
    if (!active || url || loadError) return;
    let cancelled = false;
    signedVideoUrl(reel.storage_path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [active, url, loadError, reel.storage_path]);

  // Only the active reel plays; inactive ones pause and rewind to free resources.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      setPaused(false);
      void video.play().catch(() => setPaused(true));
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active, url]);

  // A view is counted once per mount, after 3s of actual playback of the active reel.
  useEffect(() => {
    if (!active || viewedRef.current || !url) return;
    const t = setTimeout(() => {
      viewedRef.current = true;
      void registerView(reel.id);
    }, 3000);
    return () => clearTimeout(t);
  }, [active, url, reel.id]);

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Sign in to like reels.");
      if (liked) await unlikeReel(reel.id, currentUserId);
      else await likeReel(reel.id, currentUserId);
    },
    onMutate: () => {
      onLikedChange(reel.id, !liked);
      setLikeCount((c) => Math.max(0, c + (liked ? -1 : 1)));
    },
    onError: (e: Error) => {
      onLikedChange(reel.id, liked);
      setLikeCount(reel.like_count);
      toast.error(e.message || "We couldn't save that like.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["reels-feed"] }),
  });

  const share = async () => {
    const link = reelShareUrl(reel.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bible Connect Reel", url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      // user dismissed the share sheet — nothing to report
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-foreground/95">
      {loadError ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-background">
          <p className="text-sm">This video couldn&apos;t be loaded.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoadError(false);
              setUrl(null);
            }}
          >
            Try again
          </Button>
        </div>
      ) : !url ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-background/70" />
        </div>
      ) : (
        <video
          ref={videoRef}
          src={url}
          className="h-full w-full object-contain"
          playsInline
          muted={muted}
          preload="metadata"
          onClick={togglePlay}
          onError={() => setLoadError(true)}
          onEnded={(e) => {
            // Replay the SAME reel — never auto-advance.
            const v = e.currentTarget;
            v.currentTime = 0;
            void v.play().catch(() => setPaused(true));
          }}
        />
      )}

      {paused && url && !loadError && (
        <button
          type="button"
          aria-label="Play video"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="rounded-full bg-background/80 p-4">
            <Play className="h-7 w-7" />
          </span>
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 to-transparent p-4 pb-6">
        <div className="pointer-events-auto flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1 text-background">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 border border-background/40">
                {reel.author?.avatar_url && <AvatarImage src={reel.author.avatar_url} alt="" />}
                <AvatarFallback className="text-xs">
                  {initialsOf(reel.author?.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium">
                {reel.author?.display_name ?? "Member"}
              </span>
              <span className="text-xs opacity-70">{formatRelativeDate(reel.created_at)}</span>
            </div>
            {reel.caption && (
              <p className="mt-2 line-clamp-3 text-sm opacity-95">{reel.caption}</p>
            )}
            {reel.hashtags?.length > 0 && (
              <p className="mt-1 text-xs opacity-80">
                {reel.hashtags.map((t) => `#${t}`).join(" ")}
              </p>
            )}
            <p className="mt-1 text-xs opacity-70">{reel.view_count} views</p>
          </div>

          <div className="flex flex-col items-center gap-4 text-background">
            <ActionButton
              label={liked ? "Unlike" : "Like"}
              onClick={() => toggleLike.mutate()}
              count={likeCount}
            >
              <Heart className={cn("h-6 w-6", liked && "fill-current text-red-500")} />
            </ActionButton>
            <ActionButton
              label="Comments"
              onClick={() => setCommentsOpen(true)}
              count={reel.comment_count}
            >
              <MessageCircle className="h-6 w-6" />
            </ActionButton>
            <ActionButton label="Share" onClick={share}>
              <Share2 className="h-6 w-6" />
            </ActionButton>
            <ActionButton label={muted ? "Unmute" : "Mute"} onClick={onToggleMute}>
              {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </ActionButton>
            <ActionButton label={paused ? "Play" : "Pause"} onClick={togglePlay}>
              {paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </ActionButton>
          </div>
        </div>
      </div>

      <ReelComments
        reelId={reel.id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        currentUserId={currentUserId}
      />
    </section>
  );
}

function ActionButton({
  label,
  onClick,
  count,
  children,
}: {
  label: string;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-background transition-transform active:scale-90"
    >
      {children}
      {count != null && <span className="text-xs">{count}</span>}
    </button>
  );
}
