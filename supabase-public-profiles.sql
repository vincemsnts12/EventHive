-- ============================================
-- Public Profile Viewing - Database Setup
-- ============================================
-- Run this in your Supabase SQL Editor

-- 1. Add UNIQUE constraint on username column
-- First, handle any existing duplicates by appending user_id suffix
DO $$
DECLARE
    dup_username TEXT;
    dup_id UUID;
    counter INT;
BEGIN
    -- Find and fix duplicate usernames
    FOR dup_username IN 
        SELECT username 
        FROM profiles 
        WHERE username IS NOT NULL 
        GROUP BY username 
        HAVING COUNT(*) > 1
    LOOP
        counter := 1;
        FOR dup_id IN 
            SELECT id FROM profiles 
            WHERE username = dup_username 
            ORDER BY created_at DESC
            OFFSET 1  -- Skip the first (oldest) one, keep its username
        LOOP
            UPDATE profiles 
            SET username = dup_username || '_' || counter
            WHERE id = dup_id;
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- 2. Now add the unique constraint
ALTER TABLE profiles 
ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- 3. Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- 4. Create RPC function to get profile by username (for public profile viewing)
CREATE OR REPLACE FUNCTION get_profile_by_username(p_username TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    bio TEXT,
    avatar_url TEXT,
    cover_photo_url TEXT,
    email TEXT,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only return if caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to view profiles';
    END IF;
    
    -- Return profile data (excluding sensitive fields like is_admin, has_password)
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.bio,
        p.avatar_url,
        p.cover_photo_url,
        -- Get email from auth.users table
        u.email,
        p.created_at
    FROM profiles p
    LEFT JOIN auth.users u ON p.id = u.id
    WHERE LOWER(p.username) = LOWER(p_username);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_profile_by_username(TEXT) TO authenticated;
