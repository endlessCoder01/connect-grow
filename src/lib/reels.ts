export const MAX_REEL_SECONDS = 70;
export const MAX_REEL_FILE_BYTES = 120 * 1024 * 1024; // 120 MB
export const MAX_COMMENT_LENGTH = 500;

const ALLOWED_VIDEO_MIME = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-m4v",
];

const ALLOWED_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv", "ogg"];

export function fileExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1]!.replace(/[^a-z0-9]/g, "") : "";
}

/** Rejects by MIME *and* extension — a filename alone is never trusted. */
export function validateVideoFile(file: File): string | null {
  const ext = fileExtension(file.name);
  const mimeOk = ALLOWED_VIDEO_MIME.includes(file.type);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  if (!mimeOk || !extOk) {
    return "Unsupported file type. Upload an MP4, WebM, MOV or M4V video.";
  }
  if (file.size <= 0) return "That file appears to be empty or corrupt.";
  if (file.size > MAX_REEL_FILE_BYTES) {
    return `File is too large (${formatFileSize(file.size)}). Maximum is 120 MB.`;
  }
  return null;
}

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "reel";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-80);
  return cleaned || "reel";
}

export function buildReelStoragePath(userId: string, fileName: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `reels/${userId}/${unique}-${safeFileName(fileName)}`;
}

/** Reads video duration client-side so we can reject anything over 70s. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
    setTimeout(() => done(null), 10000);
  });
}

/** Accepts "#Jesus gospel, #Worship" and returns ["jesus","gospel","worship"]. */
export function parseHashtags(input: string): string[] {
  const tags = input
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9_]/g, ""))
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 15);
}

export const SUGGESTED_HASHTAGS = [
  "Jesus",
  "Gospel",
  "Worship",
  "Bible",
  "Prayer",
  "Faith",
] as const;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSeconds(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function initialsOf(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "BC";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function reelShareUrl(reelId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/reels/${reelId}`;
}
