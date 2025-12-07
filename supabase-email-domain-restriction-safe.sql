-- ===== EMAIL DOMAIN RESTRICTION FIX (SAFE VERSION) =====
-- Run this in Supabase SQL Editor to enforce @tup.edu.ph email restriction
-- This updates the handle_new_user() function to prevent non-TUP emails from signing up
-- 
-- IMPORTANT: This will prevent ALL new signups with non-TUP emails at the database level
-- Existing users are not affected

-- ===== STEP 1: Check current function (optional - for verification) =====
-- Uncomment the line below to see your current function definition:
-- SELECT pg_get_functiondef('public.handle_new_user'::regproc);

-- ===== STEP 2: Update handle_new_user() FUNCTION =====
-- This matches your existing profiles table structure:
-- id, email, username, full_name, avatar_url, cover_photo_url, bio, is_admin, created_at, updated_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Enforce email domain restriction: Only allow @tup.edu.ph emails
  -- This prevents non-TUP users from being created in the database
  IF NEW.email IS NULL OR LOWER(NEW.email) NOT LIKE '%@tup.edu.ph' THEN
    -- Raise exception to prevent profile creation
    -- This should rollback the transaction, preventing the user from being created in auth.users
    RAISE EXCEPTION 'Email domain not allowed. Only @tup.edu.ph email addresses are permitted.';
  END IF;
  
  -- Insert into profiles table matching your current table structure
  -- Only inserting columns that are required (cover_photo_url, bio, created_at, updated_at have defaults)
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
$$;

-- ===== VERIFICATION =====
-- After running this, test by trying to sign up with a non-TUP email
-- The signup should fail with: "Email domain not allowed. Only @tup.edu.ph email addresses are permitted."
--
-- To verify the function was updated, run:
-- SELECT pg_get_functiondef('public.handle_new_user'::regproc);

