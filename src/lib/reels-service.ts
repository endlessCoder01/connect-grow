import { supabase } from "@/integrations/supabase/client";

export type ReelAuthor = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Reel = {
  id: string;
  user_id: string;
  storage_path: string;
  caption: string | null;
  hashtags: string[];
  duration_seconds: number;
  status: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: ReelAuthor | null;
};

export type ReelComment = {
  id: string;
  reel_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  author: ReelAuthor | null;
};

export const REELS_PAGE_SIZE = 4;

const REEL_COLUMNS =
  "id, user_id, storage_path, caption, hashtags, duration_seconds, status, view_count, like_count, comment_count, created_at";

async function attachAuthors<T extends { user_id: string }>(rows: T[]) {
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  if (!ids.length) return new Map<string, ReelAuthor>();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p as ReelAuthor]));
}

export async function fetchReelsPage(page: number): Promise<Reel[]> {
  const from = page * REELS_PAGE_SIZE;
  const { data, error } = await supabase
    .from("reels")
    .select(REEL_COLUMNS)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(from, from + REELS_PAGE_SIZE - 1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Reel[];
  const authors = await attachAuthors(rows);
  return rows.map((r) => ({ ...r, author: authors.get(r.user_id) ?? null }));
}

export async function fetchReelById(reelId: string): Promise<Reel | null> {
  const { data, error } = await supabase
    .from("reels")
    .select(REEL_COLUMNS)
    .eq("id", reelId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Reel;
  const authors = await attachAuthors([row]);
  return { ...row, author: authors.get(row.user_id) ?? null };
}

export async function fetchMyReels(userId: string): Promise<Reel[]> {
  const { data, error } = await supabase
    .from("reels")
    .select(REEL_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Reel[]).map((r) => ({ ...r, author: null }));
}

export async function signedVideoUrl(storagePath: string, expiresIn = 60 * 60) {
  const { data, error } = await supabase.storage
    .from("videos")
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not load this video");
  return data.signedUrl;
}

export async function fetchMyLikes(reelIds: string[], userId: string) {
  if (!reelIds.length) return new Set<string>();
  const { data, error } = await supabase
    .from("reel_likes")
    .select("reel_id")
    .eq("user_id", userId)
    .in("reel_id", reelIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.reel_id));
}

export async function likeReel(reelId: string, userId: string) {
  const { error } = await supabase.from("reel_likes").insert({ reel_id: reelId, user_id: userId });
  if (error && error.code !== "23505") throw error;
}

export async function unlikeReel(reelId: string, userId: string) {
  const { error } = await supabase
    .from("reel_likes")
    .delete()
    .eq("reel_id", reelId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchComments(reelId: string): Promise<ReelComment[]> {
  const { data, error } = await supabase
    .from("reel_comments")
    .select("id, reel_id, user_id, comment, created_at")
    .eq("reel_id", reelId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ReelComment[];
  const authors = await attachAuthors(rows);
  return rows.map((c) => ({ ...c, author: authors.get(c.user_id) ?? null }));
}

export async function addComment(reelId: string, userId: string, comment: string) {
  const { error } = await supabase
    .from("reel_comments")
    .insert({ reel_id: reelId, user_id: userId, comment });
  if (error) throw error;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from("reel_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function fetchReelTags(reelId: string): Promise<ReelAuthor[]> {
  const { data, error } = await supabase
    .from("reel_tags")
    .select("tagged_user_id")
    .eq("reel_id", reelId);
  if (error) throw error;
  const ids = (data ?? []).map((t) => t.tagged_user_id);
  if (!ids.length) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  return (profiles ?? []) as ReelAuthor[];
}

export async function searchProfiles(term: string, excludeId?: string): Promise<ReelAuthor[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .ilike("display_name", `%${q}%`)
    .limit(8);
  if (error) throw error;
  return ((data ?? []) as ReelAuthor[]).filter((p) => p.id !== excludeId);
}

export async function registerView(reelId: string) {
  await supabase.rpc("increment_reel_view", { _reel_id: reelId });
}

/** Deletes the row (RLS enforces ownership) then removes the storage object. */
export async function deleteReel(reel: Pick<Reel, "id" | "storage_path">) {
  const { error, count } = await supabase
    .from("reels")
    .delete({ count: "exact" })
    .eq("id", reel.id);
  if (error) throw error;
  if (!count) throw new Error("You can only delete your own reels.");
  await supabase.storage.from("videos").remove([reel.storage_path]);
}
