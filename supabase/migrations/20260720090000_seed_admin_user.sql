DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@connect.com',
    crypt('admin123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Admin"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = COALESCE(auth.users.raw_user_meta_data, EXCLUDED.raw_user_meta_data),
    updated_at = NOW()
  RETURNING id INTO admin_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin'::public.app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'user'::public.app_role)
  ON CONFLICT DO NOTHING;
END $$;