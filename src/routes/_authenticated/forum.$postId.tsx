import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function postQuery(id: string) {
  return queryOptions({
    queryKey: ["forum-post", id],
    queryFn: async () => {
      const { data: post, error } = await supabase
        .from("forum_posts")
        .select("id, title, body, created_at, user_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!post) throw notFound();
      const { data: comments } = await supabase
        .from("forum_comments")
        .select("id, body, created_at, user_id")
        .eq("post_id", id)
        .order("created_at", { ascending: true });
      const ids = Array.from(new Set([post.user_id, ...(comments ?? []).map((c) => c.user_id)]));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name]));
      return {
        post: { ...post, author: map[post.user_id] ?? "A friend" },
        comments: (comments ?? []).map((c) => ({ ...c, author: map[c.user_id] ?? "A friend" })),
      };
    },
  });
}

export const Route = createFileRoute("/_authenticated/forum/$postId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(postQuery(params.postId)),
  component: PostPage,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <h1 className="text-2xl">Post not found</h1>
      <Button asChild className="mt-4"><Link to="/forum">Back</Link></Button>
    </div>
  ),
});

function PostPage() {
  const { postId } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(postId));
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in required");
      const { error } = await supabase.from("forum_comments").insert({
        post_id: postId,
        user_id: userData.user.id,
        body,
      });
      if (error) throw error;
      setBody("");
      qc.invalidateQueries({ queryKey: ["forum-post", postId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/forum" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Discussion
        </Link>
      </div>
      <PageHeader title={data.post.title} subtitle={`${data.post.author} · ${formatDistanceToNow(new Date(data.post.created_at), { addSuffix: true })}`} />
      <div className="px-5">
        <Card className="p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.post.body}</p>
        </Card>

        <h2 className="mt-8 mb-3 text-lg font-semibold">Replies ({data.comments.length})</h2>
        <Suspense fallback={<Skeleton className="h-20 w-full" />}>
          <div className="space-y-3">
            {data.comments.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="text-xs text-muted-foreground">
                  {c.author} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
              </Card>
            ))}
          </div>
        </Suspense>

        <form onSubmit={addComment} className="mt-6 space-y-3">
          <Textarea
            placeholder="Share your thoughts…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-24"
            required
          />
          <Button type="submit" className="h-11 w-full" disabled={posting || !body.trim()}>
            {posting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reply
          </Button>
        </form>
      </div>
    </div>
  );
}
