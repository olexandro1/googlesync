/*
  # Add admin user

  1. Changes
    - Create or update admin user in auth.users table
    - Add or update corresponding entry in public.users table
    
  2. Security
    - Uses secure password hashing
    - Sets up proper role assignment
    - Handles existing email cases safely
*/

DO $$
BEGIN
  -- Create or update admin user in auth.users
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@example.com'
  ) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'ad3d1f8c-d459-45f9-a48c-e6d4bd160c12',
      'authenticated',
      'authenticated',
      'admin@example.com',
      crypt('admin-password', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"], "role": "admin"}',
      '{"role": "admin"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET 
      raw_app_meta_data = '{"provider": "email", "providers": ["email"], "role": "admin"}',
      raw_user_meta_data = '{"role": "admin"}',
      updated_at = now()
    WHERE email = 'admin@example.com';
  END IF;

  -- Add or update corresponding entry in public.users
  INSERT INTO public.users (
    id,
    email,
    role,
    created_at
  ) 
  SELECT
    COALESCE(
      (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
      'ad3d1f8c-d459-45f9-a48c-e6d4bd160c12'
    ),
    'admin@example.com',
    'admin',
    now()
  ON CONFLICT (email) 
  DO UPDATE SET
    role = 'admin';
END $$;