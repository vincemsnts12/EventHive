-- =============================================
-- FIX: Avatar URL not persisting for users
-- =============================================
-- Problems identified:
-- 1. The on_auth_user_created trigger is MISSING from the database
-- 2. Google OAuth provides avatar as 'avatar_url' in user_metadata
-- 3. Existing profiles may have NULL avatar_url
-- 
-- Run this ENTIRE script in Supabase Dashboard -> SQL Editor

-- =============================================
-- STEP 1: Create/Update the handle_new_user() function
-- =============================================
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
    -- Check both 'avatar_url' (Google OAuth) and 'picture' (other providers)
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Update avatar if it was NULL and now we have one
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 2: Create the MISSING trigger on auth.users
-- =============================================
-- Drop if exists to avoid errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- STEP 3: Create a function to sync avatar from auth.users to profiles
-- =============================================
-- This updates EXISTING profiles that have NULL avatar_url
CREATE OR REPLACE FUNCTION public.sync_profile_avatars()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles p
  SET 
    avatar_url = COALESCE(
      u.raw_user_meta_data->>'avatar_url',
      u.raw_user_meta_data->>'picture'
    ),
    full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    updated_at = NOW()
  FROM auth.users u
  WHERE p.id = u.id
    AND p.avatar_url IS NULL
    AND (u.raw_user_meta_data->>'avatar_url' IS NOT NULL 
         OR u.raw_user_meta_data->>'picture' IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 4: Run the sync for all existing users with NULL avatar
-- =============================================
SELECT public.sync_profile_avatars();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Avatar fix applied successfully!';
  RAISE NOTICE '- handle_new_user() function updated';
  RAISE NOTICE '- on_auth_user_created trigger created';
  RAISE NOTICE '- Existing profiles synced with auth.users avatars';
END $$;

