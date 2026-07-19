import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MessageSquare, ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const postsQuery = queryOptions({
  queryKey: ["forum-posts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("forum_posts")
      .select("id, title, body, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const ids = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    if (!ids.length) return [];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name]));
    return (data ?? []).map((p) => ({ ...p, author: map[p.user_id] ?? "A friend" }));
  },
});

export const Route = createFileRoute("/_authenticated/forum")({
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: ForumPage,
});

function ForumPage() {
  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
      </div>
      <PageHeader
        title="Discussion"
        subtitle="Ask questions. Encourage one another."
        right={
          <Button asChild size="sm" className="gap-1">
            <Link to="/forum/new"><Plus className="h-4 w-4" /> Post</Link>
          </Button>
        }
      />
      <div className="px-5">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <PostList />
        </Suspense>
      </div>
    </div>
  );
}

function PostList() {
  const { data } = useSuspenseQuery(postsQuery);
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-semibold">No discussions yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Start the first thread.</p>
        <Button asChild className="mt-4"><Link to="/forum/new">New post</Link></Button>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((p) => (
        <Link key={p.id} to="/forum/$postId" params={{ postId: p.id }}>
          <Card className="p-4 transition hover:border-primary/40">
            <div className="text-xs text-muted-foreground">
              {p.author} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
            </div>
            <div className="mt-1 font-semibold">{p.title}</div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
