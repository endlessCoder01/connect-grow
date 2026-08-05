import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/music";

export type PlayingTrack = {
  id: string;
  title: string;
  artist: string | null;
  url: string;
};

export function MusicPlayer({
  track,
  onClose,
  onError,
  onEnded,
}: {
  track: PlayingTrack;
  onClose: () => void;
  onError: (message: string) => void;
  onEnded: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setCurrent(0);
    setDuration(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    void audio.play().catch(() => setPlaying(false));
  }, [track.url]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      onError("Playback was blocked. Tap play again.");
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-40 border-t border-border bg-background/98 backdrop-blur">
      <div className="container-mobile px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            onClick={() => void toggle()}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{track.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {loading ? "Loading…" : (track.artist ?? "Unknown artist")}
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              className="w-24"
              value={[volume * 100]}
              max={100}
              step={1}
              onValueChange={([v]) => {
                const next = (v ?? 100) / 100;
                setVolume(next);
                if (audioRef.current) audioRef.current.volume = next;
              }}
              aria-label="Volume"
            />
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close player">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(current)}
          </span>
          <Slider
            className="flex-1"
            value={[duration ? (current / duration) * 100 : 0]}
            max={100}
            step={0.1}
            onValueChange={([v]) => {
              if (audioRef.current && duration) {
                audioRef.current.currentTime = ((v ?? 0) / 100) * duration;
              }
            }}
            aria-label="Seek"
          />
          <span className="w-10 text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={track.url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setLoading(false);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {setPlaying(false); onEnded();}}
        onError={() => {
          setLoading(false);
          setPlaying(false);
          onError("We couldn't play this track. The file may be missing or unsupported.");
        }}
      />
    </div>
  );
}
