import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Upload as UploadIcon, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { searchProfiles, type ReelAuthor } from "@/lib/reels-service";
import {
  buildReelStoragePath,
  formatFileSize,
  formatSeconds,
  MAX_REEL_SECONDS,
  parseHashtags,
  readVideoDuration,
  SUGGESTED_HASHTAGS,
  validateVideoFile,
} from "@/lib/reels";

export const Route = createFileRoute("/_authenticated/reels/upload")({
  head: () => ({
    meta: [
      { title: "Upload a Reel — Share a gospel video | Bible Connect" },
      {
        name: "description",
        content:
          "Upload a gospel video of 70 seconds or less, add a caption, hashtags and tag members of your community.",
      },
      { property: "og:title", content: "Upload a Reel — Bible Connect" },
      { property: "og:description", content: "Share a short gospel video with your community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReelsUpload,
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Something went wrong loading the upload page.
    </div>
  ),
});

function ReelsUpload() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [tagged, setTagged] = useState<ReelAuthor[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);

  const { data: userId } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const { data: matches } = useQuery({
    queryKey: ["reel-tag-search", tagSearch, userId],
    queryFn: () => searchProfiles(tagSearch, userId ?? undefined),
    enabled: tagSearch.trim().length >= 2,
  });

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setDuration(null);
    setProgress(0);
  };

  const handleSelect = async (selected: File | undefined) => {
    if (!selected) return;
    const invalid = validateVideoFile(selected);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setChecking(true);
    const secs = await readVideoDuration(selected);
    setChecking(false);
    if (secs == null) {
      toast.error("We couldn't read that video. It may be corrupt or unsupported.");
      return;
    }
    if (secs > MAX_REEL_SECONDS) {
      toast.error("Your Reel must be 70 seconds or less.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setDuration(secs);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const hashtags = parseHashtags(hashtagInput);

  const publish = async () => {
    if (!file || !userId || duration == null) return;
    if (duration > MAX_REEL_SECONDS) {
      toast.error("Your Reel must be 70 seconds or less.");
      return;
    }
    setUploading(true);
    setProgress(10);
    const path = buildReelStoragePath(userId, file.name);
    try {
      const { error: storageError } = await supabase.storage
        .from("videos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (storageError) throw storageError;
      setProgress(70);

      const { data: inserted, error: dbError } = await supabase
        .from("reels")
        .insert({
          user_id: userId,
          storage_path: path,
          caption: caption.trim() || null,
          hashtags,
          duration_seconds: Math.round(duration),
        })
        .select("id")
        .single();
      if (dbError || !inserted) {
        await supabase.storage.from("videos").remove([path]);
        throw dbError ?? new Error("Could not save reel");
      }
      setProgress(90);

      if (tagged.length) {
        const { error: tagError } = await supabase
          .from("reel_tags")
          .insert(tagged.map((t) => ({ reel_id: inserted.id, tagged_user_id: t.id })));
        if (tagError) toast.warning("Reel published, but we couldn't save the tags.");
      }
      setProgress(100);
      toast.success("Your reel is live");
      reset();
      setCaption("");
      setHashtagInput("");
      setTagged([]);
      navigate({ to: "/reels/explore" });
    } catch {
      toast.error("Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pb-10">
      <PageHeader title="Upload a Reel" subtitle="Videos of 70 seconds or less." />

      <div className="space-y-4 px-5">
        <Card className="p-4">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            className="hidden"
            onChange={(e) => void handleSelect(e.target.files?.[0])}
          />
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-sm text-muted-foreground"
            >
              {checking ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <UploadIcon className="h-6 w-6" />
              )}
              {checking ? "Checking video…" : "Choose a video from your device"}
              <span className="text-xs">MP4, WebM, MOV or M4V · max 120 MB · max 70s</span>
            </button>
          ) : (
            <div className="space-y-3">
              <video
                src={previewUrl ?? undefined}
                controls
                playsInline
                className="max-h-80 w-full rounded-xl bg-foreground/90 object-contain"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatSeconds(duration)} · {formatFileSize(file.size)}
                </span>
                <Button variant="ghost" size="sm" onClick={reset} disabled={uploading}>
                  <X className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-2">
          <Label htmlFor="caption">Caption</Label>
          <Textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 500))}
            placeholder="Share what God is doing…"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hashtags">Hashtags</Label>
          <Input
            id="hashtags"
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            placeholder="#Jesus #Worship #Faith"
          />
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_HASHTAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHashtagInput((v) => `${v} #${t}`.trim())}
                className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
              >
                #{t}
              </button>
            ))}
          </div>
          {hashtags.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Will save: {hashtags.map((t) => `#${t}`).join(" ")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tag-people">Tag people</Label>
          <Input
            id="tag-people"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Search members by name"
          />
          {!!matches?.length && (
            <Card className="divide-y divide-border">
              {matches
                .filter((m) => !tagged.some((t) => t.id === m.id))
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary/60"
                    onClick={() => {
                      setTagged((prev) => [...prev, m]);
                      setTagSearch("");
                    }}
                  >
                    {m.display_name ?? "Member"}
                  </button>
                ))}
            </Card>
          )}
          {tagged.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagged.map((t) => (
                <Badge key={t.id} variant="secondary" className="gap-1">
                  {t.display_name ?? "Member"}
                  <button
                    type="button"
                    aria-label={`Remove ${t.display_name ?? "member"}`}
                    onClick={() => setTagged((prev) => prev.filter((p) => p.id !== t.id))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {uploading && <Progress value={progress} />}

        <Button className="w-full" disabled={!file || uploading} onClick={() => void publish()}>
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…
            </>
          ) : (
            "Publish reel"
          )}
        </Button>
      </div>
    </div>
  );
}
