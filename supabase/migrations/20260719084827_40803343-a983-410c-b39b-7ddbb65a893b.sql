DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','user_roles','churches','church_members','calendar_events','forum_posts','forum_comments','prayer_requests','prayers','testimonies']) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
  FOR t IN SELECT unnest(ARRAY['profiles','churches','church_members','calendar_events','forum_posts','forum_comments','prayer_requests','prayers','testimonies']) LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;