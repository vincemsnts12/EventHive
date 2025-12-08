-- ============================================
-- MIGRATION: Remove full_name from profiles table
-- ============================================
-- This migration removes the full_name column from the profiles table
-- since we are using username exclusively for user identification.
--
-- Run this in the Supabase SQL Editor after updating the codebase.
-- ============================================

-- Step 1: Drop the full_name column from profiles table
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS full_name;

-- Step 2: Update the handle_new_user trigger to not set full_name
-- (Replace the existing trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, avatar_url, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    -- Derive username from email (e.g., axel.magallanes from axel.magallanes@tup.edu.ph)
    COALESCE(
      SPLIT_PART(new.email, '@', 1),
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      'user_' || LEFT(new.id::text, 8)
    ),
    -- Get avatar from OAuth metadata or use null
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      null
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    avatar_url = COALESCE(
      EXCLUDED.avatar_url,
      profiles.avatar_url
    ),
    updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Verify the column was dropped
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'full_name';
-- (Should return 0 rows)

-- IMPORTANT: After running this migration:
-- 1. Deploy the updated codebase (with full_name references removed)
-- 2. Test profile creation with Google OAuth
-- 3. Test profile editing
