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

export const Route = createFileRoute("/_authenticated/calendar/new")({
  component: NewEvent,
});

function NewEvent() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in required");
      const { error } = await supabase.from("calendar_events").insert({
        created_by: userData.user.id,
        title,
        description: description || null,
        location: location || null,
        starts_at: new Date(startsAt).toISOString(),
      });
      if (error) throw error;
      toast.success("Event added");
      navigate({ to: "/calendar" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/calendar" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Calendar
        </Link>
      </div>
      <PageHeader title="New event" />
      <form onSubmit={submit} className="space-y-4 px-5">
        <div>
          <Label htmlFor="t">Title</Label>
          <Input id="t" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-12" />
        </div>
        <div>
          <Label htmlFor="s">Starts at</Label>
          <Input id="s" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 h-12" />
        </div>
        <div>
          <Label htmlFor="l">Location</Label>
          <Input id="l" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 h-12" placeholder="Church, address, or link" />
        </div>
        <div>
          <Label htmlFor="d">Description</Label>
          <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-24" />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading || !title.trim() || !startsAt}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create
        </Button>
      </form>
    </div>
  );
}
