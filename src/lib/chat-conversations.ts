//chats lib
export type PinnedChat = {
  userId: string;
  display_name: string | null;
  avatar_url: string | null;
  startedAt: string;
};

const PINNED_CHAT_KEY = "bible-connect:pinned-chats";

export function readPinnedChats(userId: string) {
  if (typeof window === "undefined") return [] as PinnedChat[];
  try {
    const raw = window.localStorage.getItem(`${PINNED_CHAT_KEY}:${userId}`);
    const parsed = raw ? (JSON.parse(raw) as PinnedChat[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as PinnedChat[];
  }
}

export function pinChat(
  me: string | null,
  other: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  },
) {
  if (!me || typeof window === "undefined") return;
  const current = readPinnedChats(me);
const next: PinnedChat[] = [
  {
    userId: other.id,
    display_name: other.display_name,
    avatar_url: other.avatar_url ?? null,
    startedAt: new Date().toISOString(),
  },
  ...current.filter((item) => item.userId !== other.id),
].slice(0, 20);
  window.localStorage.setItem(`${PINNED_CHAT_KEY}:${me}`, JSON.stringify(next));
}