-- ===== EMAIL DOMAIN RESTRICTION FIX =====
-- Run this in Supabase SQL Editor to enforce @tup.edu.ph email restriction
-- This updates the handle_new_user() function to prevent non-TUP emails from signing up
-- 
-- IMPORTANT: This will prevent ALL new signups with non-TUP emails at the database level
-- Existing users are not affected

-- ===== UPDATE handle_new_user() FUNCTION =====
-- This matches your EXACT current function format, just adds email domain check
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  -- Enforce email domain restriction: Only allow @tup.edu.ph emails
  -- This prevents non-TUP users from being created in the database
  IF NEW.email IS NULL OR LOWER(NEW.email) NOT LIKE '%@tup.edu.ph' THEN
    -- Raise exception to prevent profile creation
    -- This should rollback the transaction, preventing the user from being created in auth.users
    RAISE EXCEPTION 'Use the email provided by the TUP University';
  END IF;

  INSERT INTO public.profiles (id, email, username, full_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    FALSE -- Default to non-admin on signup
  );
  RETURN NEW;
END;
$function$;

-- ===== VERIFICATION =====
-- After running this, test by trying to sign up with a non-TUP email
-- The signup should fail with: "Email domain not allowed. Only @tup.edu.ph email addresses are permitted."

