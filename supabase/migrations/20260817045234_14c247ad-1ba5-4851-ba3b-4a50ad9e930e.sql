CREATE TABLE public.reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  hashtags text[] NOT NULL DEFAULT '{}',
  duration_seconds numeric NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 70),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  view_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reels_created_at ON public.reels (created_at DESC);
CREATE INDEX idx_reels_user ON public.reels (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reels TO authenticated;
GRANT ALL ON public.reels TO service_role;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reels readable by authenticated" ON public.reels FOR SELECT TO authenticated USING (status = 'published' OR user_id = auth.uid());
CREATE POLICY "reels insert own" ON public.reels FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels update own" ON public.reels FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels delete own" ON public.reels FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_reels_updated_at BEFORE UPDATE ON public.reels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reel_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);
CREATE INDEX idx_reel_likes_reel ON public.reel_likes (reel_id);
GRANT SELECT, INSERT, DELETE ON public.reel_likes TO authenticated;
GRANT ALL ON public.reel_likes TO service_role;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable" ON public.reel_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes insert own" ON public.reel_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes delete own" ON public.reel_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL CHECK (length(btrim(comment)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reel_comments_reel ON public.reel_comments (reel_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reel_comments TO authenticated;
GRANT ALL ON public.reel_comments TO service_role;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable" ON public.reel_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments insert own" ON public.reel_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments update own" ON public.reel_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments delete own or reel owner" ON public.reel_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.reels r WHERE r.id = reel_id AND r.user_id = auth.uid()));
CREATE TRIGGER trg_reel_comments_updated_at BEFORE UPDATE ON public.reel_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reel_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  tagged_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, tagged_user_id)
);
CREATE INDEX idx_reel_tags_reel ON public.reel_tags (reel_id);
GRANT SELECT, INSERT, DELETE ON public.reel_tags TO authenticated;
GRANT ALL ON public.reel_tags TO service_role;
ALTER TABLE public.reel_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags readable" ON public.reel_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags insert by reel owner" ON public.reel_tags FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.reels r WHERE r.id = reel_id AND r.user_id = auth.uid()));
CREATE POLICY "tags delete by reel owner" ON public.reel_tags FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.reels r WHERE r.id = reel_id AND r.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.update_reel_like_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
  ELSE
    UPDATE public.reels SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_reel_like_count AFTER INSERT OR DELETE ON public.reel_likes FOR EACH ROW EXECUTE FUNCTION public.update_reel_like_count();

CREATE OR REPLACE FUNCTION public.update_reel_comment_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET comment_count = comment_count + 1 WHERE id = NEW.reel_id;
  ELSE
    UPDATE public.reels SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.reel_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_reel_comment_count AFTER INSERT OR DELETE ON public.reel_comments FOR EACH ROW EXECUTE FUNCTION public.update_reel_comment_count();

CREATE OR REPLACE FUNCTION public.increment_reel_view(_reel_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.reels SET view_count = view_count + 1 WHERE id = _reel_id AND status = 'published';
END; $$;
REVOKE EXECUTE ON FUNCTION public.increment_reel_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_reel_view(uuid) TO authenticated;