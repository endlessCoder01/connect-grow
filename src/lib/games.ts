// Shared, client-safe game configuration.

export const QUESTIONS_PER_SESSION = 10;

/** Central XP configuration — tweak here, everywhere follows. */
export const XP_RULES = {
  perCorrectAnswer: 100,
  gameCompletion: 50,
  streakBonusEvery: 5,
  streakBonusAmount: 100,
  highScoreThreshold: 0.9, // accuracy needed for the high-score bonus
  highScoreBonus: 200,
} as const;

/** Base points per correct answer by difficulty. */
export const POINTS_BY_DIFFICULTY: Record<string, number> = {
  easy: 80,
  medium: 100,
  hard: 120,
};

/** Fast-answer bonus (points) — full bonus under 3s, none after 15s. */
export const SPEED_BONUS_MAX = 40;
export const SPEED_BONUS_FAST_MS = 3000;
export const SPEED_BONUS_SLOW_MS = 15000;

/** Clue penalty for Guess the Character (per extra clue revealed). */
export const CLUE_PENALTY = 25;

export type PlayableSlug = "trivia" | "true-or-false" | "character" | "complete-verse";

export const PLAYABLE_SLUGS: PlayableSlug[] = [
  "trivia",
  "true-or-false",
  "character",
  "complete-verse",
];

/** Per-question seconds. null = untimed. */
export const GAME_TIMER_SECONDS: Record<string, number | null> = {
  trivia: 25,
  "true-or-false": 10,
  character: null,
  "complete-verse": 20,
};

export const GAME_INSTRUCTIONS: Record<string, string[]> = {
  trivia: [
    "10 multiple-choice questions across the whole Bible.",
    "25 seconds per question — answer quickly for a speed bonus.",
    "Build a streak of correct answers for bonus XP.",
  ],
  "true-or-false": [
    "10 statements. Decide if each is true or false.",
    "Only 10 seconds per statement — think fast.",
    "Accuracy and streaks both earn you XP.",
  ],
  character: [
    "Identify the Bible figure from up to three clues.",
    "You start with one clue — reveal more if you need them.",
    "The fewer clues you use, the higher your score.",
  ],
  "complete-verse": [
    "A well-known verse is shown with a word missing.",
    "Pick the word that completes it within 20 seconds.",
    "The full reference is revealed after each answer.",
  ],
};

export function levelFromXp(totalXp: number) {
  // Each level costs 1000 XP more than the last: 1000, 2000, 3000 ...
  let level = 1;
  let remaining = totalXp;
  let cost = 1000;
  while (remaining >= cost) {
    remaining -= cost;
    level += 1;
    cost += 1000;
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: cost };
}

/** Daily play streak from a list of completion dates (ISO strings). */
export function dailyStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
    } else if (i > 0 || !days.has(key)) {
      if (i === 0) continue; // today not played yet — streak can still run to yesterday
      break;
    }
  }
  return streak;
}
