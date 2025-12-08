-- =============================================
-- FIX: Avatar URL not saving for Google OAuth users
-- =============================================
-- Problem: Google OAuth stores avatar as 'picture', not 'avatar_url'
-- This migration updates the handle_new_user() function to check both fields
-- 
-- Run this in Supabase Dashboard -> SQL Editor

-- Update the handle_new_user function to check both 'avatar_url' and 'picture'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Enforce email domain restriction: Only allow @tup.edu.ph emails
  IF NEW.email IS NULL OR LOWER(NEW.email) NOT LIKE '%@tup.edu.ph' THEN
    RAISE EXCEPTION 'Email domain not allowed. Only @tup.edu.ph email addresses are permitted.';
  END IF;
  
  INSERT INTO public.profiles (id, email, username, full_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    -- Check both 'avatar_url' (standard) and 'picture' (Google OAuth)
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update existing profiles that have NULL avatar_url but should have Google picture
-- This one-time fix updates users who signed up before this fix was applied
-- Note: We cannot directly access auth.users from public schema, so this needs
-- to be run separately if there are existing users with missing avatars
