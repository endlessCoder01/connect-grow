import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionReview } from "@/lib/games.functions";
import { Check, Gamepad2, RotateCcw, Trophy, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/games/results/$sessionId")({
  component: ResultsPage,
  errorComponent: () => (
    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
      We couldn&apos;t load those results.
    </div>
  ),
});

function ResultsPage() {
  const { sessionId } = Route.useParams();
  const review = useServerFn(getSessionReview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["game-review", sessionId],
    queryFn: () => review({ data: { sessionId } }),
  });

  if (isLoading) {
    return (
      <div className="px-5 pt-10">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
        Results unavailable. <Link to="/games" className="text-primary">Back to games</Link>
      </div>
    );
  }

  const s = data.session;
  const game = (s as unknown as { games: { slug: string; name: string } | null }).games;

  return (
    <div className="pb-10">
      <PageHeader title="Game complete" subtitle={game?.name ?? "Bible game"} />
      <div className="px-5">
        <Card className="border-none bg-primary p-6 text-center text-primary-foreground shadow-lg">
          <Trophy className="mx-auto h-8 w-8 text-gold" />
          <div className="mt-3 text-xs uppercase tracking-widest text-gold">Score</div>
          <div className="text-5xl font-semibold">{(s.score ?? 0).toLocaleString()}</div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Accuracy" value={`${Math.round(Number(s.accuracy ?? 0))}%`} />
            <Stat label="Correct" value={`${s.correct_answers}/${s.questions_answered}`} />
            <Stat label="Best streak" value={String(s.best_streak)} />
          </div>
          <div className="mt-4 inline-flex rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-gold-foreground">
            +{(s.xp_earned ?? 0).toLocaleString()} XP
          </div>
        </Card>

        <div className="mt-4 grid gap-2">
          <Button asChild className="h-12 gap-2">
            <Link to="/games/play/$slug" params={{ slug: game?.slug ?? "trivia" }}>
              <RotateCcw className="h-4 w-4" /> Play again
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 gap-2">
            <Link to="/games/leaderboard">
              <Trophy className="h-4 w-4" /> View leaderboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 gap-2">
            <Link to="/games">
              <Gamepad2 className="h-4 w-4" /> Back to games
            </Link>
          </Button>
        </div>

        <h2 className="mt-8 mb-3 text-lg font-semibold">Review</h2>
        <div className="space-y-3">
          {data.answers.map((a, i) => {
            const q = (a as unknown as {
              game_questions: {
                question: string;
                correct_answer: string;
                explanation: string | null;
                verse_reference: string | null;
              } | null;
            }).game_questions;
            return (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-2">
                  {a.is_correct ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{q?.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your answer: {a.answer ?? "No answer"} · Correct: {q?.correct_answer}
                    </p>
                    {q?.verse_reference && (
                      <p className="mt-1 text-xs font-medium text-gold">{q.verse_reference}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-primary-foreground/10 py-2">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-primary-foreground/70">{label}</div>
    </div>
  );
}
