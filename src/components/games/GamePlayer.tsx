import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  finishGameSession,
  startGameSession,
  submitAnswer,
} from "@/lib/games.functions";
import { GAME_INSTRUCTIONS, GAME_TIMER_SECONDS } from "@/lib/games";
import { gameIcon } from "./icons";
import { Check, ChevronRight, Flame, Lightbulb, Loader2, Play, Timer, X } from "lucide-react";

type Question = {
  id: string;
  question: string;
  options: string[];
  clues: string[];
  difficulty: string;
  category: string;
};

type Feedback = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string | null;
  verseReference: string | null;
  pointsEarned: number;
};

export function GamePlayer({
  slug,
  name,
  description,
  icon,
}: {
  slug: string;
  name: string;
  description: string;
  icon: string;
}) {
  const navigate = useNavigate();
  const start = useServerFn(startGameSession);
  const answerFn = useServerFn(submitAnswer);
  const finishFn = useServerFn(finishGameSession);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cluesShown, setCluesShown] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const questionStart = useRef<number>(Date.now());
  const sessionStart = useRef<number>(Date.now());
  const timerSeconds = GAME_TIMER_SECONDS[slug] ?? null;
  const Icon = gameIcon(icon);
  const current = questions[index];

  const startMutation = useMutation({
    mutationFn: () => start({ data: { slug } }),
    onSuccess: (res) => {
      setSessionId(res.sessionId);
      setQuestions(res.questions as Question[]);
      setIndex(0);
      setScore(0);
      setStreak(0);
      setSelected(null);
      setFeedback(null);
      setCluesShown(1);
      sessionStart.current = Date.now();
      questionStart.current = Date.now();
      setSecondsLeft(GAME_TIMER_SECONDS[slug] ?? null);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not start the game"),
  });

  const answerMutation = useMutation({
    mutationFn: (vars: { answer: string | null }) =>
      answerFn({
        data: {
          sessionId: sessionId!,
          questionId: current!.id,
          answer: vars.answer,
          responseTimeMs: Date.now() - questionStart.current,
          cluesUsed: cluesShown,
        },
      }),
    onSuccess: (res) => {
      setFeedback(res as Feedback);
      setScore((s) => s + res.pointsEarned);
      setStreak((s) => (res.isCorrect ? s + 1 : 0));
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not save that answer");
      setSelected(null);
    },
  });

  const finishMutation = useMutation({
    mutationFn: () =>
      finishFn({
        data: {
          sessionId: sessionId!,
          durationSeconds: Math.round((Date.now() - sessionStart.current) / 1000),
        },
      }),
    onSuccess: (res) =>
      navigate({ to: "/games/results/$sessionId", params: { sessionId: res.sessionId } }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not save your results"),
  });

  const answer = useCallback(
    (value: string | null) => {
      if (feedback || answerMutation.isPending || !current || !sessionId) return;
      setSelected(value);
      answerMutation.mutate({ answer: value });
    },
    [answerMutation, current, feedback, sessionId],
  );

  // Per-question countdown
  useEffect(() => {
    if (!current || feedback || timerSeconds == null) return;
    setSecondsLeft(timerSeconds);
    const started = Date.now();
    const id = window.setInterval(() => {
      const left = timerSeconds - Math.floor((Date.now() - started) / 1000);
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        answer(null);
      }
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, feedback]);

  function next() {
    if (index + 1 >= questions.length) {
      finishMutation.mutate();
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
    setCluesShown(1);
    questionStart.current = Date.now();
  }

  // ---- Intro screen ----
  if (!sessionId) {
    return (
      <div className="px-5 pb-10">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            {(GAME_INSTRUCTIONS[slug] ?? []).map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                {line}
              </li>
            ))}
          </ul>
          <Button
            className="mt-6 h-12 w-full gap-2"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start game
          </Button>
        </Card>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="px-5">
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  const progress = ((index + (feedback ? 1 : 0)) / questions.length) * 100;
  const clues = current.clues ?? [];

  return (
    <div className="px-5 pb-12">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Question {index + 1} of {questions.length}
        </span>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 text-gold">
              <Flame className="h-4 w-4" /> {streak}
            </span>
          )}
          <span className="font-semibold">{score.toLocaleString()}</span>
        </div>
      </div>
      <Progress value={progress} className="h-2" />

      {timerSeconds != null && !feedback && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
            (secondsLeft ?? 0) <= 5
              ? "bg-destructive/10 text-destructive"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          <Timer className="h-3.5 w-3.5" /> {secondsLeft ?? timerSeconds}s
        </div>
      )}

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="capitalize">
            {current.difficulty}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {current.category}
          </Badge>
        </div>

        {clues.length > 0 ? (
          <div className="mt-4 space-y-2">
            {clues.slice(0, cluesShown).map((clue, i) => (
              <p key={clue} className="scripture text-lg leading-relaxed">
                <span className="mr-2 text-xs uppercase tracking-widest text-muted-foreground">
                  Clue {i + 1}
                </span>
                {clue}
              </p>
            ))}
            {!feedback && cluesShown < clues.length && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-2"
                onClick={() => setCluesShown((c) => c + 1)}
              >
                <Lightbulb className="h-4 w-4" /> Reveal another clue
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-lg font-medium leading-snug">{current.question}</p>
        )}

        <div className="mt-5 grid gap-2">
          {current.options.map((option) => {
            const isPicked = selected === option;
            const isRight = feedback && option === feedback.correctAnswer;
            const isWrongPick = feedback && isPicked && !feedback.isCorrect;
            return (
              <button
                key={option}
                type="button"
                onClick={() => answer(option)}
                disabled={!!feedback || answerMutation.isPending}
                className={cn(
                  "flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm font-medium transition active:scale-[0.99]",
                  !feedback && "hover:border-primary/50 hover:bg-accent",
                  isPicked && !feedback && "border-primary bg-accent",
                  isRight && "border-primary bg-primary/10 text-primary",
                  isWrongPick && "border-destructive bg-destructive/10 text-destructive",
                )}
              >
                {option}
                {isRight && <Check className="h-4 w-4 shrink-0" />}
                {isWrongPick && <X className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>

        {answerMutation.isPending && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        )}

        {feedback && (
          <div className="mt-5 rounded-xl bg-muted/60 p-4">
            <div
              className={cn(
                "flex items-center gap-2 text-sm font-semibold",
                feedback.isCorrect ? "text-primary" : "text-destructive",
              )}
            >
              {feedback.isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {feedback.isCorrect
                ? `Correct · +${feedback.pointsEarned} points`
                : `Not quite — ${feedback.correctAnswer}`}
            </div>
            {feedback.explanation && (
              <p className="mt-2 text-sm text-muted-foreground">{feedback.explanation}</p>
            )}
            {feedback.verseReference && (
              <p className="mt-1 text-xs font-medium text-gold">{feedback.verseReference}</p>
            )}
            <Button
              className="mt-4 h-11 w-full gap-2"
              onClick={next}
              disabled={finishMutation.isPending}
            >
              {finishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {index + 1 >= questions.length ? "See results" : "Next question"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
