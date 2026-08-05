import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  Music4,
  Play,
  Search,
  Trash2,
  Upload,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MusicPlayer, type PlayingTrack } from "@/components/music/MusicPlayer";
import {
  buildStoragePath,
  fileTypeLabel,
  formatDuration,
  formatFileSize,
  formatUploadedDate,
  readAudioDuration,
  validateAudioFile,
} from "@/lib/music";

export const Route = createFileRoute("/_authenticated/music")({
  head: () => ({
    meta: [
      { title: "Gospel Music — Listen and share | Bible Connect" },
      {
        name: "description",
        content:
          "Upload, stream and download gospel music shared by the Bible Connect community. Free worship for everyone.",
      },
      { property: "og:title", content: "Gospel Music — Bible Connect" },
      {
        property: "og:description",
        content: "Stream and share worship music with your church community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MusicPage,
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Something went wrong loading music.
    </div>
  ),
});

type Track = {
  id: string;
  uploader_id: string;
  title: string;
  artist: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  duration_seconds: number | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

function MusicPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [current, setCurrent] = useState<PlayingTrack | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const {
    data: tracks,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["music-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("music_tracks")
        .select(
          `id, uploader_id, title, artist, storage_path, file_name, mime_type, file_size, duration_seconds, created_at`
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Track[];
    },
  });

  const signedUrl = async (path: string, download?: string) => {
    const { data, error } = await supabase.storage
      .from("music")
      .createSignedUrl(path, 60 * 60, download ? { download } : undefined);
    if (error || !data?.signedUrl) throw error ?? new Error("Could not create link");
    return data.signedUrl;
  };

  const handlePlay = async (track: Track) => {
    setBusyId(track.id);
    try {
      const url = await signedUrl(track.storage_path);
      setCurrent({ id: track.id, title: track.title, artist: track.artist, url });
    } catch {
      toast.error("We couldn't start playback. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleNextTrack = async () => {
  if (!current || !filtered.length) return;

  const currentIndex = filtered.findIndex(
    (track) => track.id === current.id
  );

  // If the current song is not found, do nothing
  if (currentIndex === -1) return;

  // If this is the last song, stop
  if (currentIndex === filtered.length - 1) {
    setCurrent(null);
    return;
  }

  const nextTrack = filtered[currentIndex + 1];

  setBusyId(nextTrack.id);

  try {
    const url = await signedUrl(nextTrack.storage_path);

    setCurrent({
      id: nextTrack.id,
      title: nextTrack.title,
      artist: nextTrack.artist,
      url,
    });
  } catch {
    toast.error("We couldn't start the next song.");
  } finally {
    setBusyId(null);
  }
};

  const handleDownload = async (track: Track) => {
    setBusyId(track.id);
    try {
      const url = await signedUrl(track.storage_path, track.file_name);
      const a = document.createElement("a");
      a.href = url;
      a.download = track.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (track: Track) => {
    setBusyId(track.id);
    try {
      const { error: dbError } = await supabase
        .from("music_tracks")
        .delete()
        .eq("id", track.id);
      if (dbError) throw dbError;
      await supabase.storage.from("music").remove([track.storage_path]);
      if (current?.id === track.id) setCurrent(null);
      toast.success("Track removed");
      await queryClient.invalidateQueries({ queryKey: ["music-tracks"] });
    } catch {
      toast.error("We couldn't remove that track.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = (tracks ?? []).filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      (t.artist ?? "").toLowerCase().includes(q) ||
      (t.profiles?.display_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className={current ? "pb-28" : undefined}>
      <PageHeader
        title="Music"
        subtitle="Worship together — upload, listen and share."
        right={<UploadDialog />}
      />

      <div className="px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs, artists or uploaders"
            className="pl-9"
            aria-label="Search music"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3 px-5 pb-8">
        {isLoading && (
          <>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </>
        )}

        {error && (
          <Card className="flex flex-col items-center gap-3 p-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t load the music library.
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </Card>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <Music4 className="h-7 w-7 text-muted-foreground" />
            <p className="font-medium">
              {search ? "No matching songs" : "No music yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search
                ? "Try a different search."
                : "Be the first to share a worship song with the community."}
            </p>
          </Card>
        )}

        {filtered.map((track) => (
          <Card key={track.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Music4 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-medium leading-tight">{track.title}</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {track.artist ?? track.profiles?.display_name ?? "Unknown artist"}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {fileTypeLabel(track.mime_type, track.file_name)} ·{" "}
                  {formatDuration(track.duration_seconds)} ·{" "}
                  {formatFileSize(track.file_size)} ·{" "}
                  {formatUploadedDate(track.created_at)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="gap-1"
                disabled={busyId === track.id}
                onClick={() => void handlePlay(track)}
              >
                {busyId === track.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {current?.id === track.id ? "Playing" : "Play"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={busyId === track.id}
                onClick={() => void handleDownload(track)}
              >
                <Download className="h-4 w-4" /> Download
              </Button>
              {me === track.uploader_id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive"
                  disabled={busyId === track.id}
                  onClick={() => void handleDelete(track)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

     {current && (
  <MusicPlayer
    track={current}
    onClose={() => setCurrent(null)}
    onError={(m) => toast.error(m)}
    onEnded={() => void handleNextTrack()}
  />
)}
    </div>
  );
}

function UploadDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setTitle("");
    setArtist("");
    setFile(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async () => {
    if (!file) return toast.error("Choose an audio file first.");
    const invalid = validateAudioFile(file);
    if (invalid) return toast.error(invalid);
    const cleanTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");
    if (cleanTitle.length > 120) return toast.error("Title is too long.");

    setUploading(true);
    setProgress(10);
    let path: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You need to be signed in to upload.");

      const duration = await readAudioDuration(file);
      setProgress(30);

      path = buildStoragePath(userId, file.name);
      const { error: uploadError } = await supabase.storage
        .from("music")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      setProgress(80);

      const { error: dbError } = await supabase.from("music_tracks").insert({
        uploader_id: userId,
        title: cleanTitle.slice(0, 120),
        artist: artist.trim().slice(0, 120) || null,
        storage_path: path,
        file_name: file.name.slice(0, 200),
        mime_type: file.type,
        file_size: file.size,
        duration_seconds: duration,
      });
      if (dbError) {
        // Roll back the orphaned object so storage never drifts from metadata.
        await supabase.storage.from("music").remove([path]);
        throw dbError;
      }

      setProgress(100);
      toast.success("Song uploaded");
      await queryClient.invalidateQueries({ queryKey: ["music-tracks"] });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!uploading) {
          setOpen(next);
          if (!next) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload music</DialogTitle>
          <DialogDescription>
            MP3, WAV, OGG, M4A, AAC or FLAC — up to 25 MB.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="music-file">Audio file</Label>
            <Input
              id="music-file"
              ref={inputRef}
              type="file"
              accept="audio/*"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="music-title">Title</Label>
            <Input
              id="music-title"
              value={title}
              disabled={uploading}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="music-artist">Artist</Label>
            <Input
              id="music-artist"
              value={artist}
              disabled={uploading}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist or worship team"
            />
          </div>
          {uploading && <Progress value={progress} className="h-2" />}
        </div>
        <DialogFooter>
          <Button className="w-full gap-2" disabled={uploading} onClick={() => void submit()}>
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? "Uploading…" : "Upload song"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
