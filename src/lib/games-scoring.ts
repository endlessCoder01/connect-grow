import {
  CLUE_PENALTY,
  POINTS_BY_DIFFICULTY,
  SPEED_BONUS_FAST_MS,
  SPEED_BONUS_MAX,
  SPEED_BONUS_SLOW_MS,
  XP_RULES,
} from "./games";

export function speedBonus(responseTimeMs: number) {
  if (responseTimeMs <= SPEED_BONUS_FAST_MS) return SPEED_BONUS_MAX;
  if (responseTimeMs >= SPEED_BONUS_SLOW_MS) return 0;
  const span = SPEED_BONUS_SLOW_MS - SPEED_BONUS_FAST_MS;
  return Math.round(SPEED_BONUS_MAX * (1 - (responseTimeMs - SPEED_BONUS_FAST_MS) / span));
}

/** Authoritative grading of a single answer. Runs on the server only. */
export function gradeAnswer(opts: {
  correctAnswer: string;
  difficulty: string;
  answer: string | null;
  responseTimeMs: number;
  cluesUsed?: number;
}) {
  const responseTimeMs = Math.max(0, Math.min(opts.responseTimeMs || 0, 10 * 60 * 1000));
  const isCorrect =
    typeof opts.answer === "string" &&
    opts.answer.trim().toLowerCase() === opts.correctAnswer.trim().toLowerCase();

  let points = 0;
  if (isCorrect) {
    const base = POINTS_BY_DIFFICULTY[opts.difficulty] ?? 100;
    const clues = Math.max(1, Math.min(opts.cluesUsed ?? 1, 3));
    points = Math.max(20, base + speedBonus(responseTimeMs) - (clues - 1) * CLUE_PENALTY);
  }
  return { isCorrect, points, responseTimeMs };
}

/** Aggregate persisted answer rows into the final session result + XP. */
export function summariseAnswers(
  rows: Array<{ is_correct: boolean; points_earned: number }>,
) {
  let score = 0;
  let correct = 0;
  let streak = 0;
  let bestStreak = 0;

  for (const row of rows) {
    if (row.is_correct) {
      correct += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      score += row.points_earned;
    } else {
      streak = 0;
    }
  }

  const questionsAnswered = rows.length;
  const incorrect = questionsAnswered - correct;
  const accuracyRatio = questionsAnswered ? correct / questionsAnswered : 0;

  let xp =
    correct * XP_RULES.perCorrectAnswer +
    XP_RULES.gameCompletion +
    Math.floor(bestStreak / XP_RULES.streakBonusEvery) * XP_RULES.streakBonusAmount;
  if (questionsAnswered > 0 && accuracyRatio >= XP_RULES.highScoreThreshold) {
    xp += XP_RULES.highScoreBonus;
  }

  return {
    score,
    questionsAnswered,
    correctAnswers: correct,
    incorrectAnswers: incorrect,
    accuracy: Math.round(accuracyRatio * 10000) / 100,
    bestStreak,
    xpEarned: xp,
  };
}
