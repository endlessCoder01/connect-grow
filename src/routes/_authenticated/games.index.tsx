import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ComingSoonGameCard, GameCard, type GameSummary } from "@/components/games/GameCard";
import { dailyStreak, levelFromXp } from "@/lib/games";
import { BarChart3, Flame, Sparkles, Star, Trophy } from "lucide-react";

const gamesQuery = queryOptions({
  queryKey: ["games-catalogue"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("games")
      .select("id, slug, name, description, icon, difficulty_label, xp_reward_label, is_coming_soon")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as GameSummary[];
  },
  staleTime: 10 * 60 * 1000,
});

export const myGameStatsQuery = queryOptions({
  queryKey: ["my-game-stats"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("game_sessions")
      .select(
        "id, game_id, score, questions_answered, correct_answers, incorrect_answers, accuracy, best_streak, xp_earned, completed_at, games(slug, name)",
      )
      .eq("user_id", userData.user.id)
      .eq("completed", true)
      .order("completed_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/games/")({
  head: () => ({
    meta: [
      { title: "Bible Games — Play, learn and grow | Bible Connect" },
      {
        name: "description",
        content:
          "Play Bible trivia, true or false, guess the character and complete the verse. Earn XP, build streaks and climb the leaderboard.",
      },
      { property: "og:title", content: "Bible Games — Play, learn and grow" },
      {
        property: "og:description",
        content: "Four playable Bible games with XP, streaks, statistics and leaderboards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(gamesQuery);
    void context.queryClient.prefetchQuery(myGameStatsQuery);
  },
  component: GamesPage,
});

function GamesPage() {
  return (
    <div>
      <PageHeader
        title="Bible Games"
        subtitle="Play, learn the Word, and grow together."
        right={
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to="/games/leaderboard">
              <Trophy className="h-4 w-4" /> Ranks
            </Link>
          </Button>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-3 px-5">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        }
      >
        <GamesBody />
      </Suspense>
    </div>
  );
}

function GamesBody() {
  const { data: games } = useSuspenseQuery(gamesQuery);
  const { data: sessions } = useSuspenseQuery(myGameStatsQuery);
  const [filter, setFilter] = useState<"all" | "playable" | "soon">("all");

  const totalXp = sessions.reduce((sum, s) => sum + (s.xp_earned ?? 0), 0);
  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(totalXp);
  const streak = dailyStreak(sessions.map((s) => s.completed_at!).filter(Boolean));
  const bestScore = sessions.reduce((m, s) => Math.max(m, s.score ?? 0), 0);
  const bestByGame = new Map<string, number>();
  for (const s of sessions) {
    bestByGame.set(s.game_id, Math.max(bestByGame.get(s.game_id) ?? 0, s.score ?? 0));
  }

  const playable = games.filter((g) => !g.is_coming_soon);
  const soon = games.filter((g) => g.is_coming_soon);

  return (
    <div className="px-5 pb-6">
      <Card className="border-none bg-primary p-5 text-primary-foreground shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">Level {level}</div>
            <div className="mt-1 text-3xl font-semibold">{totalXp.toLocaleString()} XP</div>
          </div>
          <Sparkles className="h-7 w-7 text-gold" />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary-foreground/20">
          <div
            className="h-full rounded-full bg-gold transition-all"
            style={{ width: `${Math.min(100, (xpIntoLevel / xpForNextLevel) * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-primary-foreground/80">
          {(xpForNextLevel - xpIntoLevel).toLocaleString()} XP to level {level + 1}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <MiniStat icon={Flame} label="Streak" value={`${streak}d`} />
          <MiniStat icon={Star} label="Best score" value={bestScore.toLocaleString()} />
          <MiniStat icon={Trophy} label="Games" value={String(sessions.length)} />
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button asChild variant="outline" className="h-11 gap-2">
          <Link to="/games/leaderboard">
            <Trophy className="h-4 w-4" /> Leaderboard
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 gap-2">
          <Link to="/games/stats">
            <BarChart3 className="h-4 w-4" /> My stats
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex gap-2">
        {(["all", "playable", "soon"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {key === "all" ? "All games" : key === "playable" ? "Playable now" : "Coming soon"}
          </button>
        ))}
      </div>

      {filter !== "soon" && (
        <section className="mt-4">
          <h2 className="mb-3 text-lg font-semibold">Play now</h2>
          <div className="space-y-3">
            {playable.map((g) => (
              <GameCard key={g.id} game={g} bestScore={bestByGame.get(g.id)} />
            ))}
          </div>
        </section>
      )}

      {filter !== "playable" && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-semibold">Coming soon</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            These games are planned for a future release.
          </p>
          <div className="space-y-3">
            {soon.map((g) => (
              <ComingSoonGameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-primary-foreground/10 px-2 py-2">
      <Icon className="mx-auto h-4 w-4 text-gold" />
      <div className="mt-1 text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-primary-foreground/70">{label}</div>
    </div>
  );
}
