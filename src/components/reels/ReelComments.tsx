import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { addComment, deleteComment, fetchComments } from "@/lib/reels-service";
import { formatRelativeDate, initialsOf, MAX_COMMENT_LENGTH } from "@/lib/reels";

export function ReelComments({
  reelId,
  open,
  onOpenChange,
  currentUserId,
}: {
  reelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reel-comments", reelId],
    queryFn: () => fetchComments(reelId),
    enabled: open,
  });

  const post = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Write something first.");
      if (!currentUserId) throw new Error("Sign in to comment.");
      await addComment(reelId, currentUserId, trimmed.slice(0, MAX_COMMENT_LENGTH));
    },
    onSuccess: async () => {
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["reel-comments", reelId] });
      await queryClient.invalidateQueries({ queryKey: ["reels-feed"] });
    },
    onError: (e: Error) => toast.error(e.message || "We couldn't post that comment."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reel-comments", reelId] });
      await queryClient.invalidateQueries({ queryKey: ["reels-feed"] });
    },
    onError: () => toast.error("We couldn't delete that comment."),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[75dvh] flex-col p-0">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {isLoading && (
            <>
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </>
          )}
          {error && (
            <div className="text-center text-sm text-muted-foreground">
              Couldn&apos;t load comments.{" "}
              <button className="underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          {!isLoading && !error && !data?.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No comments yet — be the first to encourage.
            </p>
          )}
          {data?.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                {c.author?.avatar_url && <AvatarImage src={c.author.avatar_url} alt="" />}
                <AvatarFallback className="text-xs">
                  {initialsOf(c.author?.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {c.author?.display_name ?? "Member"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(c.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                  {c.comment}
                </p>
              </div>
              {c.user_id === currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete comment"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2 border-t border-border p-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder="Add a comment…"
            rows={1}
            className="min-h-10 resize-none"
            aria-label="Write a comment"
          />
          <Button
            onClick={() => post.mutate()}
            disabled={post.isPending || !text.trim()}
            size="icon"
            aria-label="Post comment"
          >
            {post.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
