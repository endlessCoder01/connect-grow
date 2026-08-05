CREATE TABLE public.music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  duration_seconds numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_music_tracks_created_at ON public.music_tracks (created_at DESC);
CREATE INDEX idx_music_tracks_uploader ON public.music_tracks (uploader_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_tracks TO authenticated;
GRANT ALL ON public.music_tracks TO service_role;

ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view music" ON public.music_tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can upload their own music" ON public.music_tracks FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Users can update their own music" ON public.music_tracks FOR UPDATE TO authenticated USING (auth.uid() = uploader_id) WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Users can delete their own music" ON public.music_tracks FOR DELETE TO authenticated USING (auth.uid() = uploader_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_music_tracks_updated_at BEFORE UPDATE ON public.music_tracks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Members can read music files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'music');
CREATE POLICY "Users can upload music files to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'music' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own music files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'music' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own music files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'music' AND auth.uid()::text = (storage.foldername(name))[1]);