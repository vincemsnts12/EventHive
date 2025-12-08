-- =============================================
-- Add has_password column to profiles table
-- This tracks whether OAuth users have set up a password
-- =============================================

-- Add the has_password column (default false for existing users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT FALSE;

-- Update the trigger function to include has_password in new profiles
-- It should remain FALSE for new users until they explicitly set a password
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, created_at, has_password)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.email,
    NOW(),
    FALSE  -- New users start without a password (especially OAuth users)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- For users who signed up with email/password (not OAuth), 
-- we should set has_password = TRUE
-- You can run this to update existing email/password users:
-- UPDATE public.profiles p
-- SET has_password = TRUE
-- WHERE EXISTS (
--   SELECT 1 FROM auth.users u 
--   WHERE u.id = p.id 
--   AND u.encrypted_password IS NOT NULL
--   AND u.encrypted_password != ''
-- );

-- Note: The above commented query sets has_password for existing 
-- email/password users. Run it manually if needed.
