export const MAX_MUSIC_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_AUDIO_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
  "audio/flac",
  "audio/x-m4a",
] as const;

const ALLOWED_EXTENSIONS = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "webm", "mp4"];

export function fileExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1]!.replace(/[^a-z0-9]/g, "") : "";
}

/** Rejects by MIME *and* extension — a filename alone is never trusted. */
export function validateAudioFile(file: File): string | null {
  const ext = fileExtension(file.name);
  const mimeOk = (ALLOWED_AUDIO_MIME as readonly string[]).includes(file.type);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  if (!mimeOk || !extOk) {
    return "Unsupported file type. Upload an MP3, WAV, OGG, M4A, AAC or FLAC file.";
  }
  if (file.size <= 0) return "That file appears to be empty.";
  if (file.size > MAX_MUSIC_FILE_BYTES) {
    return `File is too large (${formatFileSize(file.size)}). Maximum is 25 MB.`;
  }
  return null;
}

/** Strips directories and unsafe characters so a name can never traverse paths. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "track";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-80);
  return cleaned || "track";
}

export function buildStoragePath(userId: string, fileName: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${userId}/${unique}-${safeFileName(fileName)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatUploadedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fileTypeLabel(mime: string, fileName: string): string {
  const ext = fileExtension(fileName);
  if (ext) return ext.toUpperCase();
  return (mime.split("/")[1] ?? "audio").toUpperCase();
}

/** Reads audio duration client-side so we can store it as metadata. */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    audio.onerror = () => done(null);
    audio.src = url;
    setTimeout(() => done(null), 8000);
  });
}
