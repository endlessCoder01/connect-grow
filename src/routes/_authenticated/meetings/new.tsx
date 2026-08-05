import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meetings/new")({
  component: NewMeeting,
});

function NewMeeting() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<"zoom" | "google_meet" | "other">("zoom");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in required");
      try {
        // eslint-disable-next-line no-new
        new URL(meetingUrl);
      } catch {
        throw new Error("Enter a valid meeting URL");
      }
      const { error } = await supabase.from("meetings").insert({
        host_id: userData.user.id,
        title,
        description: description || null,
        provider,
        meeting_url: meetingUrl,
        starts_at: new Date(startsAt).toISOString(),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting scheduled");
      navigate({ to: "/meetings" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="px-5 pt-6">
        <Link to="/meetings" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Meetings
        </Link>
      </div>
      <PageHeader title="New meeting" subtitle="Paste your Zoom or Google Meet link." />
      <form onSubmit={submit} className="space-y-4 px-5">
        <div>
          <Label htmlFor="t">Title</Label>
          <Input id="t" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-12" />
        </div>
        <div>
          <Label>Provider</Label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(["zoom", "google_meet", "other"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`h-11 rounded-lg border text-sm font-medium transition ${
                  provider === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40"
                }`}
              >
                {p === "google_meet" ? "Meet" : p === "zoom" ? "Zoom" : "Other"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="u">Meeting URL</Label>
          <Input id="u" required type="url" placeholder="https://zoom.us/j/..." value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} className="mt-1 h-12" />
        </div>
        <div>
          <Label htmlFor="s">Starts at</Label>
          <Input id="s" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 h-12" />
        </div>
        <div>
          <Label htmlFor="d">Description</Label>
          <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-24" placeholder="Topic, passage, agenda…" />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading || !title.trim() || !startsAt || !meetingUrl}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Schedule
        </Button>
      </form>
    </div>
  );
}
