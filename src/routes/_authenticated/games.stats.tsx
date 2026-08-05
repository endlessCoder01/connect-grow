import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dailyStreak } from "@/lib/games";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/stats")({
  component: StatsPage,
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      Statistics unavailable right now.
    </div>
  ),
});

function StatsPage() {
  const { data: sessions, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div className="px-5 pt-10">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const list = sessions ?? [];
  const totals = list.reduce(
    (acc, s) => {
      acc.games += 1;
      acc.questions += s.questions_answered ?? 0;
      acc.correct += s.correct_answers ?? 0;
      acc.xp += s.xp_earned ?? 0;
      acc.bestScore = Math.max(acc.bestScore, s.score ?? 0);
      acc.longestStreak = Math.max(acc.longestStreak, s.best_streak ?? 0);
      return acc;
    },
    { games: 0, questions: 0, correct: 0, xp: 0, bestScore: 0, longestStreak: 0 },
  );
  const accuracy = totals.questions ? Math.round((totals.correct / totals.questions) * 100) : 0;
  const streak = dailyStreak(list.map((s) => s.completed_at!).filter(Boolean));

  const perGame = new Map<
    string,
    { name: string; games: number; questions: number; correct: number; best: number }
  >();
  for (const s of list) {
    const g = (s as unknown as { games: { slug: string; name: string } | null }).games;
    const key = g?.slug ?? s.game_id;
    const entry =
      perGame.get(key) ??
      { name: g?.name ?? "Game", games: 0, questions: 0, correct: 0, best: 0 };
    entry.games += 1;
    entry.questions += s.questions_answered ?? 0;
    entry.correct += s.correct_answers ?? 0;
    entry.best = Math.max(entry.best, s.score ?? 0);
    perGame.set(key, entry);
  }

  return (
    <div className="pb-10">
      <div className="px-5 pt-6">
        <Link to="/games" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Games
        </Link>
      </div>
      <PageHeader title="Your game stats" subtitle="Every completed game, saved securely." />

      <div className="grid grid-cols-2 gap-3 px-5">
        <Stat label="Games played" value={String(totals.games)} />
        <Stat label="Questions answered" value={String(totals.questions)} />
        <Stat label="Correct answers" value={String(totals.correct)} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="XP from games" value={totals.xp.toLocaleString()} />
        <Stat label="Best score" value={totals.bestScore.toLocaleString()} />
        <Stat label="Current day streak" value={`${streak}d`} />
        <Stat label="Longest answer streak" value={String(totals.longestStreak)} />
      </div>

      <h2 className="mt-8 mb-3 px-5 text-lg font-semibold">By game</h2>
      <div className="space-y-3 px-5">
        {perGame.size === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No games played yet.
          </div>
        )}
        {[...perGame.entries()].map(([key, g]) => (
          <Card key={key} className="p-4">
            <div className="font-semibold">{g.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Games played: {g.games} · Accuracy:{" "}
              {g.questions ? Math.round((g.correct / g.questions) * 100) : 0}% · Best score:{" "}
              {g.best.toLocaleString()}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </Card>
  );
}
