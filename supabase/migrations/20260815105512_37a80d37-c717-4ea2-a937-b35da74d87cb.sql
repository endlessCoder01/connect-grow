ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins_balance integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.game_leaderboard(text, text);

CREATE POLICY "Completed sessions readable for leaderboard" ON public.game_sessions
  FOR SELECT TO authenticated USING (completed = true);