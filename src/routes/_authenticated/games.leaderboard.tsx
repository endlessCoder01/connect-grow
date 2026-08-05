import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Trophy, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/leaderboard")({
  component: LeaderboardPage,
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Leaderboard unavailable right now.
    </div>
  ),
});

type Row = {
  user_id: string;
  total_xp: number;
  best_score: number;
  games_played: number;
  display_name: string;
  avatar_url: string | null;
};

function LeaderboardPage() {
  const [period, setPeriod] = useState<"all" | "week">("all");
  const [gameSlug, setGameSlug] = useState<string>("all");

  const { data: games } = useQuery({
    queryKey: ["games-catalogue-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("games")
        .select("id, slug, name")
        .eq("is_coming_soon", false)
        .order("sort_order");
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["leaderboard", period, gameSlug],
    queryFn: async (): Promise<Row[]> => {
      let query = supabase
        .from("game_sessions")
        .select("user_id, xp_earned, score, game_id, completed_at")
        .eq("completed", true);
      if (period === "week") {
        query = query.gte(
          "completed_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        );
      }
      if (gameSlug !== "all") {
        const g = (games ?? []).find((x) => x.slug === gameSlug);
        if (g) query = query.eq("game_id", g.id);
      }
      const { data, error } = await query.limit(2000);
      if (error) throw error;

      const agg = new Map<string, Row>();
      for (const s of data ?? []) {
        const existing = agg.get(s.user_id) ?? {
          user_id: s.user_id,
          total_xp: 0,
          best_score: 0,
          games_played: 0,
          display_name: "Friend",
          avatar_url: null,
        };
        existing.total_xp += s.xp_earned ?? 0;
        existing.best_score = Math.max(existing.best_score, s.score ?? 0);
        existing.games_played += 1;
        agg.set(s.user_id, existing);
      }
      const list = [...agg.values()].sort((a, b) => b.total_xp - a.total_xp).slice(0, 50);
      if (list.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in(
            "id",
            list.map((r) => r.user_id),
          );
        const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
        for (const r of list) {
          const p = byId.get(r.user_id);
          r.display_name = p?.display_name ?? "Friend";
          r.avatar_url = p?.avatar_url ?? null;
        }
      }
      return list;
    },
  });

  return (
    <div className="pb-10">
      <div className="px-5 pt-6">
        <Link to="/games" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Games
        </Link>
      </div>
      <PageHeader title="Leaderboard" subtitle="Real results from real play." />

      <div className="space-y-3 px-5">
        <div className="flex gap-2">
          {(["all", "week"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {p === "all" ? "All time" : "This week"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGameSlug("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              gameSlug === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            All games
          </button>
          {(games ?? []).map((g) => (
            <button
              key={g.id}
              onClick={() => setGameSlug(g.slug)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                gameSlug === g.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2 px-5">
        {isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}
        {!isLoading && (rows ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No games played yet — be the first on the board.
          </div>
        )}
        {(rows ?? []).map((r, i) => (
          <Card key={r.user_id} className="flex items-center gap-3 p-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                i < 3 ? "bg-gold text-gold-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {i + 1}
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.display_name}</div>
              <div className="text-xs text-muted-foreground">
                Best {r.best_score.toLocaleString()} · {r.games_played} games
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-primary">
              <Trophy className="h-3.5 w-3.5" /> {r.total_xp.toLocaleString()}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
