import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QUESTIONS_PER_SESSION } from "./games";
import { gradeAnswer, summariseAnswers } from "./games-scoring";

export const startGameSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: game, error: gameError } = await supabaseAdmin
      .from("games")
      .select("id, slug, name, description, is_active, is_coming_soon")
      .eq("slug", data.slug)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!game || !game.is_active || game.is_coming_soon) {
      throw new Error("This game is not available yet.");
    }

    const { data: pool, error: qError } = await supabaseAdmin
      .from("game_questions")
      .select("id, question, options, clues, difficulty, category")
      .eq("game_id", game.id)
      .eq("is_active", true);
    if (qError) throw qError;
    if (!pool || pool.length === 0) {
      throw new Error("No questions are available for this game yet.");
    }

    const questions = [...pool]
      .sort(() => Math.random() - 0.5)
      .slice(0, QUESTIONS_PER_SESSION)
      .map((q) => ({
        id: q.id,
        question: q.question,
        options: (Array.isArray(q.options) ? q.options : []) as string[],
        clues: (Array.isArray(q.clues) ? q.clues : []) as string[],
        difficulty: q.difficulty,
        category: q.category,
      }));

    const { data: session, error: sError } = await supabaseAdmin
      .from("game_sessions")
      .insert({ user_id: context.userId, game_id: game.id })
      .select("id")
      .single();
    if (sError) throw sError;

    return {
      sessionId: session.id as string,
      game: { id: game.id, slug: game.slug, name: game.name, description: game.description },
      questions,
    };
  });

/** Grades one answer server-side and persists it. First answer per question wins. */
export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        questionId: z.string().uuid(),
        answer: z.string().nullable(),
        responseTimeMs: z.number().int().min(0),
        cluesUsed: z.number().int().min(1).max(3).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("game_sessions")
      .select("id, user_id, game_id, completed")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.user_id !== context.userId) throw new Error("Session not found.");
    if (session.completed) throw new Error("This game is already finished.");

    const { data: question } = await supabaseAdmin
      .from("game_questions")
      .select("id, correct_answer, difficulty, explanation, verse_reference")
      .eq("id", data.questionId)
      .eq("game_id", session.game_id)
      .maybeSingle();
    if (!question) throw new Error("Question not found.");

    const { data: existing } = await supabaseAdmin
      .from("game_answers")
      .select("id, is_correct, points_earned")
      .eq("session_id", session.id)
      .eq("question_id", question.id)
      .maybeSingle();

    let isCorrect: boolean;
    let points: number;

    if (existing) {
      isCorrect = existing.is_correct;
      points = existing.points_earned;
    } else {
      const graded = gradeAnswer({
        correctAnswer: question.correct_answer,
        difficulty: question.difficulty,
        answer: data.answer,
        responseTimeMs: data.responseTimeMs,
        cluesUsed: data.cluesUsed,
      });
      isCorrect = graded.isCorrect;
      points = graded.points;
      await supabaseAdmin.from("game_answers").insert({
        session_id: session.id,
        question_id: question.id,
        user_id: context.userId,
        answer: data.answer,
        is_correct: graded.isCorrect,
        response_time_ms: graded.responseTimeMs,
        points_earned: graded.points,
      });
    }

    return {
      isCorrect,
      pointsEarned: points,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      verseReference: question.verse_reference,
    };
  });

/** Finalises a session from its persisted answers. Safe to call twice. */
export const finishGameSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        durationSeconds: z.number().int().min(0).max(3600),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("game_sessions")
      .select("id, user_id, completed")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.user_id !== context.userId) throw new Error("Session not found.");
    if (session.completed) return { sessionId: session.id as string, alreadyCompleted: true };

    const { data: rows } = await supabaseAdmin
      .from("game_answers")
      .select("is_correct, points_earned, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    const summary = summariseAnswers(rows ?? []);

    const { error } = await supabaseAdmin
      .from("game_sessions")
      .update({
        score: summary.score,
        questions_answered: summary.questionsAnswered,
        correct_answers: summary.correctAnswers,
        incorrect_answers: summary.incorrectAnswers,
        accuracy: summary.accuracy,
        best_streak: summary.bestStreak,
        duration_seconds: data.durationSeconds,
        xp_earned: summary.xpEarned,
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("completed", false);
    if (error) throw error;

    return { sessionId: session.id as string, alreadyCompleted: false };
  });

/** Full review of a finished session (correct answers revealed after play). */
export const getSessionReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("game_sessions")
      .select(
        "id, user_id, score, accuracy, correct_answers, incorrect_answers, questions_answered, best_streak, xp_earned, duration_seconds, completed, completed_at, games(slug, name)",
      )
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.user_id !== context.userId) throw new Error("Session not found.");

    const { data: answers } = await supabaseAdmin
      .from("game_answers")
      .select(
        "answer, is_correct, points_earned, created_at, game_questions(question, correct_answer, explanation, verse_reference)",
      )
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    return { session, answers: answers ?? [] };
  });
