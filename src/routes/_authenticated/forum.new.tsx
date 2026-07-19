import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/forum/new")({
  component: NewPost,
});

function NewPost() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in required");
      const { error } = await supabase.from("forum_posts").insert({
        user_id: userData.user.id,
        title,
        body,
      });
      if (error) throw error;
      toast.success("Posted");
      navigate({ to: "/forum" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/forum" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Discussion
        </Link>
      </div>
      <PageHeader title="New post" />
      <form onSubmit={submit} className="space-y-4 px-5">
        <div>
          <Label htmlFor="t">Title</Label>
          <Input id="t" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-12" />
        </div>
        <div>
          <Label htmlFor="b">Body</Label>
          <Textarea id="b" required value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 min-h-40" />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading || !title.trim() || !body.trim()}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Publish
        </Button>
      </form>
    </div>
  );
}
