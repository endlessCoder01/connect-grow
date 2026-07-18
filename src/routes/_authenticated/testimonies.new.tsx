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

export const Route = createFileRoute("/_authenticated/testimonies/new")({
  component: NewTestimonyPage,
});

function NewTestimonyPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("testimonies").insert({
        title,
        body,
        user_id: userData.user.id,
      });
      if (error) throw error;
      toast.success("Testimony shared. Praise God!");
      navigate({ to: "/testimonies" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/testimonies" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
      </div>
      <PageHeader title="Share a testimony" />
      <form onSubmit={submit} className="space-y-4 px-5">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 h-12"
            placeholder="God healed my friend..."
          />
        </div>
        <div>
          <Label htmlFor="body">Your story</Label>
          <Textarea
            id="body"
            required
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 min-h-40"
            placeholder="Tell others what God has done."
          />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading || !title.trim() || !body.trim()}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Share testimony
        </Button>
      </form>
    </div>
  );
}
